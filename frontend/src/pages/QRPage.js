import React, { useState, useEffect } from 'react';

const API_BASE = "/api";

export default function QRPage() {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/qr/`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setQrData(data);
        }
      })
      .catch(err => setError("No se pudo cargar el código QR."))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyLink = () => {
    if (qrData && qrData.url_destino) {
      navigator.clipboard.writeText(qrData.url_destino);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, permite las ventanas emergentes (pop-ups) para imprimir el QR.");
      return;
    }
    printWindow.document.write(`
      <html>
        <head><title>Imprimir QR</title></head>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
          <img src="data:image/png;base64,${qrData.imagen_base64}" style="max-width:80%;max-height:80%;" />
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="page-container" style={{ paddingBottom: '50px' }}>
      <h2 className="page-title" style={{ marginBottom: '10px' }}>Código QR</h2>
      <p style={{ color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center', marginBottom: '40px', fontSize: '1.1rem' }}>
        Escanea este código para acceder rápidamente al módulo Agendar Cita.
      </p>

      {loading ? (
        <p style={{ color: "white", textAlign: "center" }}>Cargando código QR...</p>
      ) : error ? (
        <p className="error-mensaje">{error}</p>
      ) : qrData ? (
        <div style={{
          background: 'rgba(16, 31, 56, 0.85)',
          border: '1px solid rgba(255, 107, 26, 0.4)',
          borderRadius: '20px',
          padding: '40px 20px',
          maxWidth: '450px',
          margin: '0 auto',
          textAlign: 'center',
          boxShadow: '0 15px 40px rgba(0, 0, 0, 0.3), 0 0 18px rgba(255, 107, 26, 0.15)'
        }}>
          <div style={{
            background: 'white',
            padding: '15px',
            borderRadius: '16px',
            display: 'inline-block',
            marginBottom: '20px'
          }}>
            <img 
              src={`data:image/png;base64,${qrData.imagen_base64}`} 
              alt="Código QR Agendar Cita" 
              style={{ width: '250px', height: '250px', display: 'block' }}
            />
          </div>
          
          <div style={{ marginBottom: '30px' }}>
            <p style={{ margin: '0 0 8px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Enlace de destino:</p>
            <a href={qrData.url_destino} target="_blank" rel="noreferrer" style={{ color: '#FF6B1A', textDecoration: 'none', wordBreak: 'break-all', fontWeight: 'bold' }}>
              {qrData.url_destino}
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <a 
              href={`data:image/png;base64,${qrData.imagen_base64}`} 
              download="codigo-qr-agendar.png"
              className="btn-agendar"
              style={{ textDecoration: 'none', display: 'inline-block', width: '100%', boxSizing: 'border-box' }}
            >
              ⬇ Descargar QR
            </a>
            
            <button 
              onClick={handlePrint}
              className="btn-secondary"
              style={{ width: '100%', margin: 0 }}
            >
              🖨 Imprimir
            </button>
            
            <button 
              onClick={handleCopyLink}
              className="btn-secondary"
              style={{ width: '100%', margin: 0, position: 'relative' }}
            >
              {copied ? '✓ Enlace copiado' : '🔗 Copiar enlace'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
