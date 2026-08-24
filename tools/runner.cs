using System;

public class Runner {
    public static int Main(string[] args) {
        // args: inPath outPath tol
        if (args.Length < 3) { Console.Error.WriteLine("usage: runner in out tol"); return 1; }
        int tol = int.Parse(args[2]);
        Cutout.Process(args[0], args[1], tol);
        return 0;
    }
}
