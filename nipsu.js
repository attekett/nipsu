#!/usr/bin/env node

var spawnTarget=require('./spawn.js')
var fs=require('fs')
var path=require('path')

function cloneArray(obj){
        var copy = [];
        for (var i = 0; i < obj.length; ++i) {
            copy[i] = obj[i];
        }
        return copy;
}

var config={
	debug:process.argv.indexOf('--debug')+1 && true || undefined,
	inputFile:(process.argv.indexOf('-i')+1 && path.resolve(process.argv[process.argv.indexOf('-i')+1])) || undefined,
	outputDirectory:(process.argv.indexOf('-o')+1 && path.resolve(process.argv[process.argv.indexOf('-o')+1])+'/') || undefined,
	timeout:(process.argv.indexOf('-t')+1 && (process.argv[process.argv.indexOf('-t')+1])*1000) || 1000,
	delimiters:(process.argv.indexOf('-d')+1 && (process.argv[process.argv.indexOf('-d')+1]).split(',')) || ['',' ','\n','<','>','\"','\'',',','.',';'],
	chunks:(process.argv.indexOf('-c')+1 && (process.argv[process.argv.indexOf('-c')+1]).split(',').reverse()) || [300,100,50,20,10,5,4,3,2,1].reverse(),
	temp:(process.argv.indexOf('-temp')+1 && (process.argv[process.argv.indexOf('-temp')+1])) || undefined,
	realtime:(process.argv.indexOf('-realtime')+1 && (process.argv[process.argv.indexOf('-realtime')+1])) || false,

}

if(!config.temp)
	config.temp=config.outputDirectory
else if(!fs.existsSync(config.temp)){
	console.log('Output directory does not exist: '+config.temp)
	console.log('Trying to create specified folder.')
	fs.mkdirSync(config.temp)	
}


var flags=['--debug','-temp','-i','-o','-t','-d','-c','-realtime']
var lastFlag=0
for(var x in process.argv){
	if(flags.indexOf(process.argv[x])!=-1){
		flags.splice(flags.indexOf(process.argv[x]),1)
		if(process.argv[x]=='--debug')
			lastFlag=x
		else
			lastFlag=(parseInt(x)+1)	
	}

}

config.target=path.resolve(process.argv[lastFlag+1])
config.args=process.argv.slice(lastFlag+2,process.argv.length)

if(!fs.existsSync(config.target)){
	console.log('Target does not exists: '+config.target)
	process.exit()
}

if(config.args.indexOf('@@')==-1){
	console.log('No place for test case specified: '+process.argv.join(' '))
	process.exit()
}
config.args[config.args.indexOf('@@')]=config.temp+'/'+path.basename(config.inputFile)+'-temp'+path.extname(config.inputFile)

for( var x in config){
	if(config[x]===undefined && x!='debug'){
		console.log(x+' not defined.')
		process.exit()
	}
}

console.log(config)

if(!fs.existsSync(config.inputFile)){
	console.log('Input file does not exist: '+config.inputFile)
	process.exit()
} 
else if(fs.statSync(config.inputFile).isDirectory()){
	console.log('Input file is actually a directory: '+config.inputFile)
	process.exit()
}

if(!fs.existsSync(config.outputDirectory)){
	console.log('Output directory does not exist: '+config.outputDirectory)
	console.log('Trying to create specified folder.')
	fs.mkdirSync(config.outputDirectory)
} 
else if(!fs.statSync(config.outputDirectory).isDirectory()){
	console.log('Output directory is actually a file: '+config.outputDirectory)
	process.exit()
}
var currentIteration=[]
var previousIteration=[]
var lastFalse

var chunkSize=config.chunks.pop()
var currentConfig=JSON.parse(JSON.stringify(config))
var currentDelimiter=currentConfig.delimiters.pop()
var previousIteration=fs.readFileSync(config.inputFile).toString('binary')
var tmpDelimiter=""
console.log('Original file size: '+previousIteration.length)
previousIteration=fs.readFileSync(config.inputFile).toString('binary').split(currentDelimiter)
				


function minimizeFurther(){
	currentIteration=cloneArray(previousIteration)
	if(lastFalse===undefined){
		lastFalse=currentIteration.length-chunkSize
		return currentIteration.join(currentDelimiter)
	}
	else{
		lastFalse-=chunkSize;
	}
	if(lastFalse<=0){
		crashCount=0
		if(config.chunks.length>0){		
			if(currentConfig.delimiters.length==0){
				currentConfig=JSON.parse(JSON.stringify(config))
				chunkSize=config.chunks.pop()
			}

			previousIteration=previousIteration.join(currentDelimiter)
			currentDelimiter=currentConfig.delimiters.pop()
			previousIteration=previousIteration.split(currentDelimiter)
			lastFalse=previousIteration.length-chunkSize		
			currentIteration=cloneArray(previousIteration)
			tmpDelimiter=currentDelimiter
			if(currentDelimiter=='\n')
				tmpDelimiter='\\n'
		}
		else{
			console.log('\nFinished')
			var fileName=path.dirname(config.inputFile)+'/'+path.basename(config.inputFile)+'-min'+path.extname(config.inputFile)
			fs.writeFileSync(fileName, previousIteration.join(currentDelimiter));
			process.exit(1)
		}
	}
	if(lastFalse<=0)
		return ""
	currentIteration.splice(lastFalse,chunkSize)
	return currentIteration.join(currentDelimiter)
}

var crashFingerPrint=""
var crashCount=0
var triesWithoutCrash=0
function minimize(){
	var testCase=new Buffer(minimizeFurther(),'binary')
	if(testCase.length!=0){
		process.stdout.clearLine()
	    process.stdout.cursorTo(0)
	    tmpDelimiter=currentDelimiter
	    if(currentDelimiter=='\n')
	    	tmpDelimiter='\\n'
	    if(config.realtime)
	    	process.stdout.write('\033c');
	    process.stdout.write('TestCaseLength: '+testCase.length+' Delimiter: "'+tmpDelimiter+'" ChunkSize: '+chunkSize+' IterationsLeft: '+Math.round((lastFalse-(lastFalse%chunkSize))/chunkSize)+' CrashCount: '+crashCount+' ')
		if(config.realtime)
			process.stdout.write('\n'+testCase.toString('binary'))
		fs.writeFileSync(config.temp+'/'+path.basename(config.inputFile)+'-temp'+path.extname(config.inputFile),testCase)
		var target=spawnTarget(config.target,config.args,config.timeout)
		target.on('crash',function(crash){
			if(crash!==null){
				if(crashFingerPrint==""){
					console.log('\nInitial crash: '+crash)
					crashFingerPrint=crash
					previousIteration=cloneArray(currentIteration)
				}
				else if(crashFingerPrint==crash){
					crashCount++
					previousIteration=cloneArray(currentIteration)
				}
				else{
					console.log('Different crash.')
					console.log('Saving different crash to :'+config.outputDirectory+'/'+crash+path.extname(config.inputFile))
					fs.writeFileSync(config.outputDirectory+'/'+crash+path.extname(config.inputFile),testCase)	
				}
			}else if(crashFingerPrint==""){
				console.log("Crash didn't reproduce... Try: "+triesWithoutCrash++)
				if(triesWithoutCrash>10)
					process.exit()
			}
			minimize()
		})
	}else{
		minimize()
	}

}



var stdin = process.stdin;

stdin.setRawMode( true );
stdin.resume();

stdin.setEncoding( 'utf8' );

stdin.on( 'data', function( key ){


  if ( key === '\u0003' ) {
    process.emit('SIGINT');
  }else if(key ==='r'){
  	config.realtime=~config.realtime
  }
});



setTimeout(function(){
process.on('SIGINT', function() {
	var fileName=path.dirname(config.inputFile)+'/'+path.basename(config.inputFile)+'-abort'+path.extname(config.inputFile)
	fs.writeFileSync(fileName, currentIteration.join(currentDelimiter));
	console.log("Aborted minimization. Current iteration written.")
	process.exit()
})
minimize()
},500)