using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class Cutout {
    public static void Process(string inPath, string outPath, int tol) {
        Bitmap bmp = new Bitmap(inPath);
        int w = bmp.Width, h = bmp.Height;
        if (bmp.PixelFormat != PixelFormat.Format32bppArgb) {
            Bitmap nb = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(nb)) { g.DrawImage(bmp, 0, 0, w, h); }
            bmp.Dispose();
            bmp = nb;
        }
        Rectangle rect = new Rectangle(0, 0, w, h);
        BitmapData data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        int stride = data.Stride;
        byte[] buf = new byte[stride * h];
        Marshal.Copy(data.Scan0, buf, 0, buf.Length);

        // Estimate background color from 4 corners (average)
        long sr = 0, sg = 0, sb = 0; int n = 0;
        int[,] corners = new int[,] { { 3, 3 }, { w - 4, 3 }, { 3, h - 4 }, { w - 4, h - 4 } };
        for (int i = 0; i < 4; i++) {
            int x = corners[i, 0], y = corners[i, 1];
            int o = y * stride + x * 4;
            sr += buf[o + 2]; sg += buf[o + 1]; sb += buf[o];
            n++;
        }
        int br = (int)(sr / n), bg = (int)(sg / n), bb = (int)(sb / n);

        int total = w * h;
        byte[] mask = new byte[total]; // 1 = background
        Queue<int> q = new Queue<int>();
        int[] dx = new int[] { -1, 1, 0, 0 };
        int[] dy = new int[] { 0, 0, -1, 1 };

        for (int x = 0; x < w; x++) { TryAdd(x, 0, buf, mask, q, stride, w, h, br, bg, bb, tol); TryAdd(x, h - 1, buf, mask, q, stride, w, h, br, bg, bb, tol); }
        for (int y = 0; y < h; y++) { TryAdd(0, y, buf, mask, q, stride, w, h, br, bg, bb, tol); TryAdd(w - 1, y, buf, mask, q, stride, w, h, br, bg, bb, tol); }

        while (q.Count > 0) {
            int idx = q.Dequeue();
            int x = idx % w, y = idx / w;
            for (int k = 0; k < 4; k++) {
                TryAdd(x + dx[k], y + dy[k], buf, mask, q, stride, w, h, br, bg, bb, tol);
            }
        }

        // Smooth alpha: soft ellipse edge. One box-blur pass on the mask to soften.
        int[] alpha = new int[total];
        for (int i = 0; i < total; i++) alpha[i] = (mask[i] == 1) ? 0 : 255;
        int[] tmp = new int[total];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int idx = y * w + x;
                if (mask[idx] == 1) { tmp[idx] = 0; continue; }
                int sum = 0, c = 0;
                for (int yy = -1; yy <= 1; yy++) for (int xx = -1; xx <= 1; xx++) {
                    int nx = x + xx, ny = y + yy;
                    if (nx >= 0 && ny >= 0 && nx < w && ny < h) { sum += alpha[ny * w + nx]; c++; }
                }
                tmp[idx] = sum / c;
            }
        }
        Array.Copy(tmp, alpha, total);

        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int idx = y * w + x; int o = y * stride + x * 4;
                buf[o + 3] = (byte)alpha[idx];
            }
        }

        Marshal.Copy(buf, 0, data.Scan0, buf.Length);
        bmp.UnlockBits(data);
        bmp.Save(outPath, ImageFormat.Png);
        bmp.Dispose();
    }

    static void TryAdd(int x, int y, byte[] buf, byte[] mask, Queue<int> q, int stride, int w, int h, int br, int bg, int bb, int tol) {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        int idx = y * w + x;
        if (mask[idx] == 1) return;
        int o = y * stride + x * 4;
        int r = buf[o + 2], g = buf[o + 1], b = buf[o];
        int d = Math.Abs(r - br) + Math.Abs(g - bg) + Math.Abs(b - bb);
        if (d <= tol) { mask[idx] = 1; q.Enqueue(idx); }
    }
}
