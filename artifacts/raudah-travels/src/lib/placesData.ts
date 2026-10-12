// Airport, City and Coordinate database for Nigerian & International travel
export interface Place {
  code: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  popular?: boolean;
}

export const POPULAR_ORIGINS: Place[] = [
  { code: "ABV", name: "Nnamdi Azikiwe International", city: "Abuja", country: "Nigeria", lat: 9.0065, lng: 7.2632, popular: true },
  { code: "LOS", name: "Murtala Muhammed International", city: "Lagos", country: "Nigeria", lat: 6.5774, lng: 3.3212, popular: true },
  { code: "KAN", name: "Mallam Aminu Kano International", city: "Kano", country: "Nigeria", lat: 12.0476, lng: 8.5246, popular: true },
  { code: "PHC", name: "Port Harcourt International", city: "Port Harcourt", country: "Nigeria", lat: 5.0155, lng: 6.9496, popular: true },
  { code: "SKO", name: "Sadiq Abubakar III International", city: "Sokoto", country: "Nigeria", lat: 12.9163, lng: 5.2072, popular: true },
];

export const POPULAR_DESTINATIONS: Place[] = [
  { code: "JED", name: "King Abdulaziz International", city: "Jeddah", country: "Saudi Arabia", lat: 21.6796, lng: 39.1565, popular: true },
  { code: "MED", name: "Prince Mohammad bin Abdulaziz", city: "Madinah", country: "Saudi Arabia", lat: 24.5534, lng: 39.7051, popular: true },
  { code: "RUH", name: "King Khalid International", city: "Riyadh", country: "Saudi Arabia", lat: 24.9576, lng: 46.6988, popular: true },
  { code: "CAI", name: "Cairo International", city: "Cairo", country: "Egypt", lat: 30.1219, lng: 31.4056, popular: true },
  { code: "DXB", name: "Dubai International", city: "Dubai", country: "United Arab Emirates", lat: 25.2532, lng: 55.3657, popular: true },
  { code: "IST", name: "Istanbul Airport", city: "Istanbul", country: "Turkey", lat: 41.2753, lng: 28.7519, popular: true },
  { code: "DOH", name: "Hamad International", city: "Doha", country: "Qatar", lat: 25.2731, lng: 51.6081, popular: true },
  { code: "LHR", name: "London Heathrow", city: "London", country: "United Kingdom", lat: 51.4700, lng: -0.4543, popular: true },
];

export const HOTEL_DESTINATIONS = [
  {
    id: "makkah",
    name: "Makkah",
    subtitle: "Al-Masjid al-Haram & Holy Kaaba",
    icon: "🕋",
    image: "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg",
    description: "Hotels walking distance to the Grand Mosque with Kaaba view suites.",
  },
  {
    id: "madinah",
    name: "Madinah",
    subtitle: "Al-Masjid an-Nabawi",
    icon: "🕌",
    image: "https://images.pexels.com/photos/26436662/pexels-photo-26436662.jpeg",
    description: "Luxury lodging right outside the Prophet's Mosque courtyard.",
  },
  {
    id: "jeddah",
    name: "Jeddah",
    subtitle: "Red Sea Coastal Gateway",
    icon: "🌴",
    image: "https://images.pexels.com/photos/34246939/pexels-photo-34246939.jpeg",
    description: "Corniche resorts and modern transit hotels near the airport.",
  },
  {
    id: "riyadh",
    name: "Riyadh",
    subtitle: "Capital City & Business Hub",
    icon: "🏙️",
    image: "https://images.pexels.com/photos/29676866/pexels-photo-29676866.jpeg",
    description: "5-star towers and central accommodations in the vibrant capital.",
  },
  {
    id: "dubai",
    name: "Dubai",
    subtitle: "Downtown & Marina Luxury",
    icon: "🏖️",
    image: "https://images.pexels.com/photos/1470405/pexels-photo-1470405.jpeg",
    description: "World-class resorts, Burj Khalifa views, and iconic hospitality.",
  },
  {
    id: "cairo",
    name: "Cairo",
    subtitle: "Historic Nile & Pyramids",
    icon: "🏛️",
    image: "https://images.pexels.com/photos/3290075/pexels-photo-3290075.jpeg",
    description: "Centuries of heritage, luxury Nile views, and historic proximity.",
  },
  {
    id: "istanbul",
    name: "Istanbul",
    subtitle: "Bosphorus & Sultanahmet",
    icon: "🕌",
    image: "https://images.pexels.com/photos/1549326/pexels-photo-1549326.jpeg",
    description: "Where East meets West with historic boutique and 5-star lodging.",
  },
];

// Helper: calculate distance in kilometers between two lat/lng coordinates (Haversine formula)
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Helper: estimate flight duration based on distance (average jet speed ~850 km/h + 30 min takeoff/landing)
export function estimateFlightTime(distanceKm: number): { hours: number; minutes: number; text: string } {
  const totalMinutes = Math.round((distanceKm / 820) * 60 + 35);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    hours,
    minutes,
    text: `${hours}h ${minutes > 0 ? `${minutes}m` : ""}`.trim(),
  };
}

export function findPlaceByCode(code: string): Place | undefined {
  const upper = (code || "").toUpperCase();
  return (
    POPULAR_ORIGINS.find((p) => p.code === upper) ||
    POPULAR_DESTINATIONS.find((p) => p.code === upper)
  );
}
