import { createServer } from 'node:http'
import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'

const port = Number(process.env.PORT) || 5000

// Initialize a variable to hold our latest data
let latestArduinoData = { bottomLevel: null, topLevel: null, pumpStatus: null };

// 1. Setup Serial Connection to Arduino
const arduinoPort = new SerialPort({
  path: 'COM3', // Ensure this matches the COM port of your Arduino
  baudRate: 9600,
});

// 2. Parse the incoming data line-by-line
const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

parser.on('data', (data) => {
  try {
    // Parse the JSON string we sent from the Arduino
    latestArduinoData = JSON.parse(data);
    console.log('Received from Arduino:', latestArduinoData);
  } catch (err) {
    console.error('Error parsing Arduino data:', data);
  }
});

arduinoPort.on('error', (err) => {
  console.error('Serial Port Error:', err.message);
});

// 3. Setup the HTTP Server
const server = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end()
    return
  }

  if (request.method === 'GET' && request.url === '/api/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', service: 'smarttank-backend' }))
    return
  }
  
  // 4. Create an endpoint for the frontend to get the Arduino state
  if (request.method === 'GET' && request.url === '/api/tank-status') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(latestArduinoData))
    return
  }

  response.writeHead(404, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(port, () => {
  console.log(`SmartTank backend listening on http://localhost:${port}`)
})