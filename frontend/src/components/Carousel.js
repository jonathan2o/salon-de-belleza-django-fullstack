import { useState, useEffect, useRef } from "react";

const slides = [
  {
    type: "image",
    url: "/corte_cabello.png"
  },
  {
    type: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-hairdresser-cutting-hair-of-a-woman-40621-large.mp4"
  },
  {
    type: "image",
    url: "/manicura_unas.png"
  },
  {
    type: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-woman-doing-manicure-on-her-nails-41712-large.mp4"
  },
  {
    type: "image",
    url: "/maquillaje.png"
  },
  {
    type: "image",
    url: "/corte_rosa.jpg"
  },
  {
    type: "image",
    url: "/corte_rosa_2.jpg"
  }
];

export default function Carousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const nextSlide = () => {
    setActiveIndex((prevIndex) => (prevIndex + 1) % slides.length);
  };

  const prevSlide = () => {
    setActiveIndex((prevIndex) => (prevIndex - 1 + slides.length) % slides.length);
  };

  // Autoplay functionality
  useEffect(() => {
    if (!isPaused) {
      timerRef.current = setInterval(nextSlide, 5000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused]);

  return (
    <div 
      className="salon-carousel-container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Carrusel de servicios del salón"
    >
      {/* Slides */}
      <div className="salon-carousel-inner">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div 
              key={index} 
              className={`salon-carousel-slide ${isActive ? "active" : ""}`}
              style={{
                display: isActive ? "block" : "none",
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%"
              }}
            >
              {slide.type === "video" ? (
                <video
                  src={slide.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundImage: `url(${slide.url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat"
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation arrows */}
      <button 
        className="salon-carousel-arrow left" 
        onClick={prevSlide}
        aria-label="Diapositiva anterior"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button 
        className="salon-carousel-arrow right" 
        onClick={nextSlide}
        aria-label="Diapositiva siguiente"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>

      {/* Indicator dots */}
      <div className="salon-carousel-indicators">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`salon-carousel-dot ${index === activeIndex ? "active" : ""}`}
            onClick={() => setActiveIndex(index)}
            aria-label={`Ir a la diapositiva ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
