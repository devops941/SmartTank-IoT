import { useState, useRef } from 'react'
import './App.css'

interface TankStatus {
  bottomSensor: number | null;
  topSensor: number | null;
  pumpOn: boolean | null;
}

function App() {
  const [status, setStatus] = useState<TankStatus>({
    bottomSensor: null,
    topSensor: null,
    pumpOn: null,
  })
  
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  // Reference to keep track of the serial connection state
  const isReadingRef = useRef(false);

  const connectSerial = async () => {
    try {
      // Prompt user to select an Arduino serial port
      const nav = navigator as any;
      if (!nav.serial) {
        throw new Error("Web Serial API not supported in this browser. Please use Chrome or Edge.");
      }
      
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 9600 });
      
      setIsConnected(true);
      setError(null);
      isReadingRef.current = true;

      // Create a stream that decodes incoming bytes to text
      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      let buffer = '';

      // Read loop
      while (isReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += value;
        // Split data into lines by newline character
        const lines = buffer.split('\n');
        
        // The last element might be an incomplete string, keep it in the buffer
        buffer = lines.pop() || '';

        // Process all complete lines
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const data = JSON.parse(trimmed);
              setStatus(data);
            } catch (err) {
              console.warn("Skipped unparseable data:", trimmed);
            }
          }
        }
      }
      
      reader.releaseLock();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to Serial Port.");
      setIsConnected(false);
    }
  };

  const getWaterLevelText = () => {
    if (!isConnected) return "Disconnected";
    if (status.bottomSensor === null) return "Reading...";
    
    const top = Number(status.topSensor);
    const bottom = Number(status.bottomSensor);

    if (top === 1) return "100% - Full";
    if (bottom === 1 && top === 0) return "50% - Filling";
    if (bottom === 0 && top === 0) return "0% - Empty";
    
    return "Error";
  }

  const getWaterLevelPercent = () => {
    if (!isConnected || status.bottomSensor === null) return 0;
    const top = Number(status.topSensor);
    const bottom = Number(status.bottomSensor);

    if (top === 1) return 100;
    if (bottom === 1) return 50;
    return 0;
  }

  const getSensorText = (val: number | null) => {
    if (!isConnected || val === null) return '--';
    return Number(val) === 1 ? 'WET' : 'DRY';
  }

  // Active low logic: Pump ON when status.pumpOn is 0 (false)
  const isPumpActive = isConnected && status.pumpOn !== null && !status.pumpOn;

  return (
    <div className="dashboard-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-drop">
            <svg viewBox="0 0 24 24" fill="currentColor" className="drop-icon">
              <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
            </svg>
          </div>
          <h1>SmartTank IoT</h1>
        </div>
        <p className="subtitle">WEB SERIAL MANAGEMENT</p>
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {!isConnected && !error && (
        <div className="connect-banner">
          <p>Please connect your Arduino via USB to begin monitoring.</p>
          <button className="connect-btn" onClick={connectSerial}>
            Connect Arduino via Web Serial
          </button>
        </div>
      )}

      <div className={`status-grid ${!isConnected ? 'grid-disabled' : ''}`}>
        {/* PUMP CARD */}
        <div className="card">
          <div className="card-header">
            <h2>PUMP ENGINE</h2>
            <div className={`status-dot ${isPumpActive ? 'dot-active' : 'dot-inactive'}`}></div>
          </div>
          
          <div className="pump-display">
            <div className={`pump-ring ${isPumpActive ? 'ring-active' : ''}`}>
              <div className="pump-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`lightning-icon ${isPumpActive ? 'icon-active' : 'icon-inactive'}`}>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className={`pump-text ${isPumpActive ? 'text-active' : 'text-inactive'}`}>
                  {isPumpActive ? 'RUNNING' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* WATER LEVEL CARD */}
        <div className="card">
          <div className="card-header level-header">
            <h2 className="multiline-header">TANK<br/>CAPACITY</h2>
            <span className="level-badge">{getWaterLevelText()}</span>
          </div>
          
          <div className="tank-container">
            <div className="tank-markers">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <div className="tank-glass">
              <div className="tank-water" style={{ height: `${getWaterLevelPercent()}%` }}>
                <svg className="wave-svg" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path d="M0,10 C30,20 70,0 100,10 L100,20 L0,20 Z" fill="currentColor" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* SENSOR CARD */}
        <div className="card">
          <div className="card-header">
            <h2>DIAGNOSTICS</h2>
          </div>
          <div className="sensor-list">
            <div className="sensor-item">
              <div className="sensor-info">
                <div className="check-circle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <span className="sensor-name">Top<br/>Sensor</span>
              </div>
              <div className={`premium-badge ${Number(status.topSensor) === 1 ? 'badge-wet' : 'badge-dry'}`}>
                {getSensorText(status.topSensor)}
              </div>
            </div>
            
            <div className="sensor-item">
              <div className="sensor-info">
                <div className="check-circle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <span className="sensor-name">Bottom<br/>Sensor</span>
              </div>
              <div className={`premium-badge ${Number(status.bottomSensor) === 1 ? 'badge-wet' : 'badge-dry'}`}>
                {getSensorText(status.bottomSensor)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
