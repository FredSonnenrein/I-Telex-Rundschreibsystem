// @ts-ignore
// tslint:disable-next-line:max-line-length no-console triple-equals


import * as readline from "readline";
import * as net from "net";
import { logger, inspect, logStream } from "./util/logging";
import AsciiInterface from "./interfaces/AsciiInterface/AsciiInterface";
import BaudotInterface from "./interfaces/BaudotInterface/BaudotInterface";
import ui from "./ui";
import Interface from "./interfaces/Interface";
import callGroup from "./callGroup";
import CallEndDetector from "./CallEndDetector";
import call from "./call";

declare global {
	interface Buffer {
		readNullTermString: (encoding?, start?, end?) => string;
	}
}
Buffer.prototype.readNullTermString = 
function readNullTermString(encoding: string = "utf8", start: number = 0, end: number = this.length):string {
	let firstZero = this.indexOf(0, start);
	let stop = firstZero >= start && firstZero <= end ? firstZero : end;
	return this.toString(encoding, start, stop);
};



const server = new net.Server();
server.on('connection', socket=>{




	let interFace:Interface;
	socket.once('data', chunk=>{
		if([0,1,2,3,4,6,7,8,9].indexOf(chunk[0]) === -1){
			interFace = new AsciiInterface(false);
		}else{
			interFace = new BaudotInterface();
		}

		interFace.external.write(chunk);

		socket.pipe(interFace.external);
		interFace.external.pipe(socket);
	

		logger.log(inspect`${interFace instanceof BaudotInterface?'baudot':'ascii'} client calling`);

		interFace.on('end',()=>{
			socket.end();
		});
	
		socket.on('error',err=>{
			logger.log('error', err);
			socket.end();
		});
	
		// interFace.on('timeout', (ext:number)=>{
			
		// });
	
		
		let logStreamIn = new logStream(inspect`calling client \x1b[033m in\x1b[0m`, interFace.internal);
		let logStreamOut = new logStream(inspect`calling client \x1b[034mout\x1b[0m`, interFace._internal);
		

		socket.on('close', ()=>{
			interFace.end();
			
			logStreamIn.end();
			logStreamOut.end();
			logger.log(inspect`calling client disconnected`);
		});

	
		const rl = readline.createInterface({
			input:interFace.internal,
			output:interFace.internal,
		});
	
		async function handleClient(){
			const result = await ui(rl);
			switch(result.nextAction){
				case 'call':
					call({
						interface:interFace,
						socket,
					}, result.callList);

					break;
				case 'end':
				default:
					// TODO: end the connection
			}
		}

		if(interFace instanceof BaudotInterface){
			interFace.on('call', ext=>{ // for baudot interface
				handleClient();
				logger.log(inspect`baudot client calling extension: ${ext}`);
			});
		}else{
			handleClient();
			logger.log(inspect`ascii client calling`);
		}
	});
});
server.listen(4000);


