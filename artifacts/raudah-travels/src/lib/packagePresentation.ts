const packageImages = [
  "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg",
  "https://images.pexels.com/photos/26436662/pexels-photo-26436662.jpeg",
  "https://images.pexels.com/photos/34246939/pexels-photo-34246939.jpeg",
  "https://images.pexels.com/photos/29676866/pexels-photo-29676866.jpeg",
];

export const packageTypeLabels: Record<string, string> = {
  hajj: "Hajj",
  umrah: "Umrah",
  visa_only: "Visa Only",
  ticket_only: "Ticket Only",
  accommodation_only: "Accommodation Only",
  visa_ticket: "Visa + Ticket",
  visa_accommodation: "Visa + Accommodation",
  accommodation_ticket: "Accommodation + Ticket",
  all: "All Types",
};

export function getPackageImage(id: string, imageUrl?: string | null) {
  const invalid =
    !imageUrl ||
    imageUrl.startsWith("/") ||
    imageUrl.includes("localhost") ||
    imageUrl.includes("127.0.0.1") ||
    imageUrl.includes(".onrender.com") ||
    imageUrl.includes(".repl.co");
  const index =
    id.split("").reduce((total, char) => total + char.charCodeAt(0), 0) %
    packageImages.length;
  return invalid ? packageImages[index] : imageUrl!;
}

export function packageBookingHref(id: string, signedIn: boolean) {
  const path = `/dashboard/book/${id}`;
  return signedIn ? path : `/sign-in?redirect_url=${path}`;
}
