
var spawn=require('child_process').spawn


/*
Create crash fingerprint out of ASAN-report.
<crash-type>-<frame #0>-<frame #1>-<frame #2>
*/
function asanFingerPrint(stderr){
	if(stderr && stderr.indexOf('ERROR: AddressSanitizer') !=-1){
		asanTrace=stderr.replace('\n','').replace(/\s+/g,' ').split(' ')
		var fingerPrint=""
		var frame=""
		if(asanTrace.indexOf('AddressSanitizer:')!=-1){
			fingerPrint+=asanTrace[asanTrace.indexOf('AddressSanitizer:')+1]
		}
		if(fingerPrint=="stack-overflow")
			return fingerPrint
		asanTrace.splice(0,asanTrace.indexOf('AddressSanitizer:'))
		if(asanTrace.indexOf('#0')!=-1){
			frame=asanTrace[asanTrace.indexOf('#0')+1]
			fingerPrint+="-"+frame.substr(frame.length-3,3)
		}
		if(asanTrace.indexOf('#1')!=-1){
			frame=asanTrace[asanTrace.indexOf('#1')+1]
			fingerPrint+="-"+frame.substr(frame.length-3,3)
		}
		if(asanTrace.indexOf('#2')!=-1){
			frame=asanTrace[asanTrace.indexOf('#2')+1]
			fingerPrint+="-"+frame.substr(frame.length-3,3)
		}

		if(fingerPrint=="")
			return null
		else{
			return fingerPrint
		}
	}
	else{
		return null
	}
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
		target.emit('crash',asanFingerPrint(stderr))
	}

	target.stderr.on('data',function(data){
		if(stderr!="" || data.toString().indexOf('ERROR: AddressSanitizer')!=-1){
			var newData=data.toString()
			stderr+=newData
			clearTimeout(target.timeout)
			target.timeout=setTimeout(function(){
				target.kill('SIGKILL')
			},1000)
			if(newData.indexOf('=='+target.pid+'==ABORTING')!=-1){
				clearTimeout(target.timeout)				
				target.kill('SIGKILL')
			}
		}
	})
	target.on('exit',exitHandler)

	target.timeout=setTimeout(function(){
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
