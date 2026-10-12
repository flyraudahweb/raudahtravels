import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Building2, Star, MapPin, Coffee, Shield, ArrowLeft, Loader2, Wifi, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface Hotel {
  id: string;
  name: string;
  destination: string;
  destinationLabel: string;
  distanceToHaram: number;
  distanceLabel: string;
  stars: number;
  boardType: string;
  boardLabel: string;
  freeCancellation: boolean;
  rateType: string;
  rateLabel: string;
  pricePerNightNgn: number;
  description: string;
  amenities: string[];
}

const ROOM_TYPES = [
  { id: "standard", label: "Standard Room", multiplier: 1, capacity: "1–2 guests", beds: "1 double bed" },
  { id: "superior", label: "Superior Room", multiplier: 1.2, capacity: "1–2 guests", beds: "1 king bed" },
  { id: "deluxe", label: "Deluxe Room", multiplier: 1.45, capacity: "2–3 guests", beds: "2 double beds" },
  { id: "suite", label: "Suite", multiplier: 2.1, capacity: "2–4 guests", beds: "1 king + living area" },
];

export default function HotelDetail() {
  const [, params] = useRoute("/hotels/:id");
  const [, setLocation] = useLocation();
  const hotelId = params?.id || "";

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState("standard");
  const [nights, setNights] = useState(7);
  const [rooms, setRooms] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/hotels/${hotelId}`);
        if (res.ok) {
          const data = await res.json();
          setHotel(data.hotel);
        }
      } finally {
        setIsLoading(false);
      }
    }
    if (hotelId) load();
  }, [hotelId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFF]">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D3199]" />
        </div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="min-h-screen bg-[#F8FAFF]">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-[#64748B]">Hotel not found.</p>
          <Button onClick={() => setLocation("/hotels")} variant="outline">Back to hotels</Button>
        </div>
      </div>
    );
  }

  const selectedRoomType = ROOM_TYPES.find((r) => r.id === selectedRoom) || ROOM_TYPES[0];
  const pricePerNight = Math.round(hotel.pricePerNightNgn * selectedRoomType.multiplier);
  const totalPrice = pricePerNight * nights * rooms;

  function handleBookNow() {
    const qs = new URLSearchParams({
      nights: String(nights),
      rooms: String(rooms),
      roomType: selectedRoom,
    });
    setLocation(`/hotels/checkout/${hotel!.id}?${qs.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      <Navbar />
      <main className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => setLocation("/hotels/search")}
            className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#2D3199] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to results
          </button>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left — hotel info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hero */}
              <div className="bg-gradient-to-br from-[#2D3199]/10 to-[#4C56B8]/20 rounded-2xl h-64 flex items-center justify-center">
                <Building2 className="w-24 h-24 text-[#2D3199]/25" />
              </div>

              {/* Header */}
              <div>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <span
                      className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full mb-2 ${
                        hotel.rateType === "raudah_direct"
                          ? "bg-[#FF3B00] text-white"
                          : "bg-[#64748B]/10 text-[#64748B]"
                      }`}
                    >
                      {hotel.rateLabel}
                    </span>
                    <h1 className="text-2xl font-black text-[#0F172A]">{hotel.name}</h1>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: hotel.stars }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-[#64748B]">
                        <MapPin className="w-3.5 h-3.5" /> {hotel.distanceLabel}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-[#64748B]">
                        <Coffee className="w-3.5 h-3.5" /> {hotel.boardLabel}
                      </span>
                      {hotel.freeCancellation && (
                        <span className="flex items-center gap-1 text-sm text-emerald-700">
                          <Shield className="w-3.5 h-3.5" /> Free cancellation
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[#64748B] leading-relaxed">{hotel.description}</p>
              </div>

              {/* Amenities */}
              <div>
                <h2 className="font-bold text-[#0F172A] mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.map((a) => (
                    <span
                      key={a}
                      className="flex items-center gap-1.5 text-sm text-[#334155] bg-white border border-[#DCE3F0] rounded-full px-3 py-1"
                    >
                      <Wifi className="w-3 h-3 text-[#2D3199]" />
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              {/* Room types */}
              <div>
                <h2 className="font-bold text-[#0F172A] mb-3">Select room type</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {ROOM_TYPES.map((room) => {
                    const price = Math.round(hotel.pricePerNightNgn * room.multiplier);
                    const isSelected = selectedRoom === room.id;
                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room.id)}
                        className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                          isSelected
                            ? "border-[#2D3199] bg-[#EEF0FF]"
                            : "border-[#DCE3F0] bg-white hover:border-[#2D3199]/40"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-[#0F172A]">{room.label}</p>
                            <p className="text-xs text-[#64748B] mt-0.5">{room.beds} · {room.capacity}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#2D3199] shrink-0 mt-0.5" />}
                        </div>
                        <p className="text-[#2D3199] font-bold mt-2">₦{price.toLocaleString()}/night</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right — booking sidebar */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-[#DCE3F0] p-6 sticky top-24 shadow-sm space-y-4"
              >
                <h3 className="font-black text-[#0F172A]">Book this hotel</h3>

                {/* Nights */}
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wide block mb-2">Nights</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={nights}
                    onChange={(e) => setNights(Math.max(1, Number(e.target.value)))}
                    className="w-full border border-[#DCE3F0] rounded-xl px-3 py-2 text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
                  />
                </div>

                {/* Rooms */}
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wide block mb-2">Rooms</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={rooms}
                    onChange={(e) => setRooms(Math.max(1, Number(e.target.value)))}
                    className="w-full border border-[#DCE3F0] rounded-xl px-3 py-2 text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2D3199]/20 focus:border-[#2D3199]"
                  />
                </div>

                {/* Price breakdown */}
                <div className="border-t border-[#DCE3F0] pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-[#64748B]">
                    <span>₦{pricePerNight.toLocaleString()} × {nights} nights × {rooms} room{rooms > 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex justify-between font-black text-[#0F172A] text-base border-t border-[#DCE3F0] pt-2">
                    <span>Total</span>
                    <span>₦{totalPrice.toLocaleString()}</span>
                  </div>
                  {hotel.freeCancellation && (
                    <p className="text-emerald-700 text-xs font-semibold flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Free cancellation included
                    </p>
                  )}
                </div>

                <Button onClick={handleBookNow} className="w-full bg-[#FF3B00] hover:bg-[#E03400] text-white font-bold rounded-xl py-3">
                  Book now
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
