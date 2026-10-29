/**
 * Premium Smooth Scroll Utility
 * Provee un desplazamiento elegante y progresivo usando requestAnimationFrame.
 */

export const smoothScrollTo = (element, options = {}) => {
  if (!element) return;
  
  const {
    duration = 1000, // 1 segundo para un efecto lento y elegante
    block = 'start', // 'start' o 'center'
    offset = 85 // Offset base para la barra de navegación fija (aprox 85px)
  } = options;

  const rect = element.getBoundingClientRect();
  const elementTop = rect.top + window.pageYOffset;
  
  let targetPosition;
  if (block === 'center') {
    targetPosition = elementTop - (window.innerHeight / 2) + (rect.height / 2);
  } else {
    targetPosition = elementTop - offset;
  }

  // Prevenir scroll más arriba del inicio de la página
  targetPosition = Math.max(0, targetPosition);

  // Prevenir scroll más abajo del final de la página
  const maxScroll = Math.max(
    document.body.scrollHeight, 
    document.documentElement.scrollHeight
  ) - window.innerHeight;
  targetPosition = Math.min(targetPosition, maxScroll);

  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  
  if (distance === 0) return; // Ya estamos en la posición correcta

  let startTime = null;

  // Easing function: easeInOutQuart - Inicio suave, aceleración central, y frenado muy suave al final
  const easeInOutQuart = (t, b, c, d) => {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t * t * t + b;
    t -= 2;
    return -c / 2 * (t * t * t * t - 2) + b;
  };

  const animation = (currentTime) => {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = easeInOutQuart(timeElapsed, startPosition, distance, duration);
    
    window.scrollTo(0, run);
    
    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    } else {
      window.scrollTo(0, targetPosition); // Asegurar que termine exactamente en el objetivo
    }
  };

  requestAnimationFrame(animation);
};
