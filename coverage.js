
var spawn=require('child_process').spawn
var path=require('path')
var fs=require('fs')

/*
Create fingerprint from ASanCoverage file.
*/

var outputDirectory=(process.argv.indexOf('-temp')+1 && path.resolve(process.argv[process.argv.indexOf('-temp')+1])+'/') || undefined

var coverageDir=""
if(outputDirectory){
	process.env.ASAN_OPTIONS=process.env.ASAN_OPTIONS+",coverage=1,coverage_bitset=1,coverage_dir="+outputDirectory
	coverageDir=outputDirectory
}
else{
	process.env.ASAN_OPTIONS=process.env.ASAN_OPTIONS+",coverage=1,coverage_bitset=1,coverage_dir=/tmp/cov/"
	coverageDir="/tmp/cov/"
}
var crypto=require('crypto')

function cleanDir(dir){
	var files=fs.readdirSync(dir)
	files.forEach(function(file){
		fs.unlinkSync(dir+'/'+file)
	})
}

cleanDir(coverageDir)

function coverageFingerPrint(){
	var covFiles=fs.readdirSync(coverageDir)
	for(var x=0; x<covFiles.length; x++){
		var module=covFiles[x].split('.')[0]
		if(module=="combined"){
			var hash=crypto.createHash('sha1').update(fs.readFileSync(coverageDir+'/'+covFiles[x])).digest('hex')
			cleanDir(coverageDir)
		//	console.log(covFiles[x]+": "+hash)
			return hash
		}
	}
	cleanDir(coverageDir)
	
	return null
}

/*
Spawn target binary
*/

function spawnTarget(target,args,timeout){
	var target=spawn(target,args)
	var stderr=""
	var stdout=""
	
	function exitHandler(code){
		/*emit crash: null or fingerprint*/
		clearTimeout(target.timeout)
		target.emit('crash',coverageFingerPrint())
		
	}

	target.on('exit',exitHandler)

	target.timeout=setTimeout(function(){
		console.log('Timeout')
		target.removeListener('exit',exitHandler)
		target.on('exit',function(){
			target.emit('crash',null)	
		})
		target.kill('SIGKILL')
	},timeout)

	return target	
}

module.exports={
	spawnTarget:spawnTarget
}
