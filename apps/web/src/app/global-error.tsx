"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ background: "#eceef4", color: "#12141c", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h2>Algo no salió como esperábamos</h2>
          <p style={{ color: "#4b5160" }}>Tus datos están a salvo. Vuelve a intentarlo.</p>
          <button onClick={reset} style={{ background: "#dc1b2e", color: "#fff", border: 0, padding: "10px 18px", borderRadius: 4, cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
