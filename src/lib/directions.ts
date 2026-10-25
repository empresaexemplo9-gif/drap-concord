// Links "Como chegar" nos apps de mapa mais usados (abrem o app no celular).
export function directionLinks(p: { lat: number; lng: number; address?: string | null }) {
  const dest = `${p.lat},${p.lng}`;
  return [
    { label: "Google Maps", href: `https://www.google.com/maps/dir/?api=1&destination=${dest}` },
    { label: "Waze", href: `https://waze.com/ul?ll=${dest}&navigate=yes` },
    { label: "Apple Mapas", href: `https://maps.apple.com/?daddr=${dest}${p.address ? `&q=${encodeURIComponent(p.address)}` : ""}` },
  ];
}
