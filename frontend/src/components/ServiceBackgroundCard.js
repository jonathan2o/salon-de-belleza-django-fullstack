import React from "react";
import "./ServiceBackgroundCard.css";

const mapToOfficialBg = (bgId) => {
  if (!bgId) return "gold";
  const map = {
    dorado: "gold", plateado: "silver", bronce: "bronze", obsidiana: "obsidian",
    zafiro: "sapphire", amatista: "amethyst", esmeralda: "emerald", rubi: "ruby",
    pink: "pink", rosa: "pink", rosado: "pink", turquoise: "turquoise",
    turquesa: "turquoise", violet: "violet", violeta: "violet", marble: "marble",
    marmol: "marble", diamante: "diamond"
  };
  return map[bgId.toLowerCase()] || bgId.toLowerCase();
};

const getThemeColor = (bgId) => {
  const colors = {
    gold: "#FFD700", silver: "#C0C0C0", bronze: "#CD7F32", obsidian: "#2C3E50",
    sapphire: "#0055FF", amethyst: "#9B59B6", emerald: "#00FF00", ruby: "#FF0000",
    pink: "#FF69B4", turquoise: "#40E0D0", violet: "#EE82EE", marble: "#ECF0F1", diamond: "#00FFFF"
  };
  return colors[bgId] || "#FFFFFF";
};

export default function ServiceBackgroundCard({ nombre, tiempo, background_id, isSelected, onClick }) {
  const bgId = mapToOfficialBg(background_id);
  // Utilizamos las imágenes HORIZONTALES panorámicas
  const imgUrl = `/assets/fondos-servicios-horizontales/${bgId}.webp`;
  const themeColor = getThemeColor(bgId);

  return (
    <div 
      className={`premium-service-card ${isSelected ? "selected" : ""}`}
      onClick={onClick}
      style={{ '--theme-color': themeColor }}
    >
      <div className="premium-service-bg-wrapper">
        <img 
          src={imgUrl} 
          alt={`Fondo ${bgId}`} 
          className="premium-service-bg-img" 
          loading="lazy" 
        />
        <div className="premium-service-overlay"></div>
      </div>

      <div className="premium-service-content">
        <div className="premium-icon-circle">
          <span>✂</span>
        </div>
        
        <span className="premium-service-title">{nombre}</span>
        
        <div className="premium-service-right-group">
          {tiempo && (
            <span className="premium-service-time">
              🕒 {tiempo} min
            </span>
          )}
          {isSelected && (
            <div className="premium-check-circle">✓</div>
          )}
        </div>
      </div>
    </div>
  );
}
