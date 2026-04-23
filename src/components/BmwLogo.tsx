export function BmwLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
      <circle cx="250" cy="250" r="235" fill="#fff" stroke="#737373" strokeWidth="30"/>
      <circle cx="250" cy="250" r="150" fill="#fff" stroke="#737373" strokeWidth="5"/>
      
      {/* Top Left - Blue */}
      <path d="M250 100 A150 150 0 0 0 100 250 L250 250 Z" fill="#0066b1"/>
      
      {/* Bottom Right - Blue */}
      <path d="M250 400 A150 150 0 0 0 400 250 L250 250 Z" fill="#0066b1"/>
      
      {/* Top Right - White */}
      <path d="M250 100 A150 150 0 0 1 400 250 L250 250 Z" fill="#ffffff"/>
      
      {/* Bottom Left - White */}
      <path d="M250 400 A150 150 0 0 1 100 250 L250 250 Z" fill="#ffffff"/>
      
      <text x="250" y="85" fontFamily="Arial, sans-serif" fontSize="70" fontWeight="bold" fill="#737373" textAnchor="middle">M</text>
      <text x="130" y="145" fontFamily="Arial, sans-serif" fontSize="70" fontWeight="bold" fill="#737373" textAnchor="middle" transform="rotate(-40 130 145)">B</text>
      <text x="370" y="145" fontFamily="Arial, sans-serif" fontSize="70" fontWeight="bold" fill="#737373" textAnchor="middle" transform="rotate(40 370 145)">W</text>
    </svg>
  );
}
