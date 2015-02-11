# nipsu
Crash repro minifier for ASan-instrumented commandline tools.

Usage: node minifier.js -i <input-file> -temp <temp-dir> -o <output-dir> <target-bin> @@

@@ will be replaced with temp-file name.(Yes. I stole that expression from afl.)


Commandline flags:

	-temp,		Directory for temporary file.
	-i,			Input file
	-o,			Output directory
	-t,			Timeout in seconds (default: 1)
	-d,			List of delimiters for rounds (default: '',' ','\n','<','>','\"','\'',',','.',';')
	-c,			List of chunk sizes for rounds (default: 300,100,50,20,10,5,4,3,2,1)
	-realtime,	Awesome realtime mode. Console prints current test case. (Runtime toggle by pressing 'r'.)

Warning: realtime-mode can mess up your console with binary files.   

