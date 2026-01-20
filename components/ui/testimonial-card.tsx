
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Card, CardContent } from "./card";

export interface Stat {
  value: string;
  label: string;
}

export interface Testimonial {
  name: string;
  title: string;
  quote?: string;
  avatarSrc: string;
  rating: number;
}

export interface ClientsSectionProps {
  tagLabel: string;
  title: string;
  description: string;
  stats: Stat[];
  testimonials: Testimonial[];
  primaryActionLabel: string;
  secondaryActionLabel: string;
  className?: string;
}

const StatCard: React.FC<Stat> = ({ value, label }) => (
  <Card className="bg-zinc-900/50 border-white/5 text-center rounded-2xl backdrop-blur-sm">
    <CardContent className="p-6">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black mt-1">{label}</p>
    </CardContent>
  </Card>
);

const StickyTestimonialCard: React.FC<{ testimonial: Testimonial; index: number }> = ({ testimonial, index }) => {
  return (
    <div
      className="sticky w-full"
      style={{ 
        top: `${120 + index * 40}px`, 
        zIndex: 10 + index 
      }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={cn(
          "p-8 md:p-10 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex flex-col min-h-[300px] w-full max-w-xl transition-all duration-700",
          "bg-zinc-900/95 border border-white/10 backdrop-blur-3xl relative overflow-hidden",
          "hover:border-red-600/30 group mb-20"
        )}
      >
        <Quote className="absolute top-6 right-8 w-16 h-16 text-white/[0.03] group-hover:text-red-600/5 transition-colors duration-1000" />

        <div className="flex items-center gap-5 relative z-10">
          <div
            className="w-16 h-16 rounded-2xl bg-cover bg-center flex-shrink-0 border border-white/10 shadow-lg group-hover:border-red-600/50 transition-all duration-500"
            style={{ backgroundImage: `url(${testimonial.avatarSrc})` }}
          />
          <div className="flex-grow">
            <p className="font-black text-xl text-white group-hover:text-red-500 transition-colors uppercase tracking-tighter">
              {testimonial.name}
            </p>
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.3em] mt-1">
              {testimonial.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 my-8 relative z-10">
          <span className="font-black text-3xl text-white tracking-tighter">{testimonial.rating.toFixed(1)}</span>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-5 w-5",
                  i < Math.floor(testimonial.rating)
                    ? "text-red-600 fill-red-600"
                    : "text-zinc-800 fill-zinc-800"
                )}
              />
            ))}
          </div>
        </div>

        {testimonial.quote && (
          <p className="text-zinc-300 text-lg md:text-xl leading-[1.4] font-light border-l-2 border-red-600/50 pl-6 relative z-10">
            &ldquo;{testimonial.quote}&rdquo;
          </p>
        )}
      </motion.div>
    </div>
  );
};

export const ClientsSection = ({
  tagLabel,
  title,
  description,
  stats,
  testimonials,
  primaryActionLabel,
  secondaryActionLabel,
  className,
}: ClientsSectionProps) => {
  const scrollContainerHeight = `${100 + testimonials.length * 30}vh`;

  return (
    <section className={cn("w-full bg-black text-white py-24 md:py-32 relative", className)}>
      <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-red-900/5 blur-[200px] rounded-full pointer-events-none -translate-x-1/2 opacity-50" />
      
      <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start relative z-10">
        
        <div className="flex flex-col gap-10 lg:sticky lg:top-32 lg:pb-32">
          <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-black uppercase tracking-[0.3em]">
            <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,1)]" />
            <span className="text-zinc-400">{tagLabel}</span>
          </div>

          <h2 className="text-6xl md:text-7xl font-black tracking-tighter leading-[0.9] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/30">
            {title}
          </h2>
          <p className="text-xl text-zinc-500 font-light leading-relaxed max-w-lg">
            {description}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 mt-8">
            <Button 
                variant="outline" 
                size="lg" 
                className="w-full sm:w-auto rounded-2xl border-white/10 hover:bg-white/5 text-zinc-400 font-black uppercase tracking-widest text-xs h-16 px-10 transition-all font-style-normal"
            >
                {secondaryActionLabel}
            </Button>
            <Button 
                size="lg" 
                className="w-full sm:w-auto rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xs h-16 px-10 shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all hover:scale-105"
            >
                {primaryActionLabel}
            </Button>
          </div>
        </div>

        <div className="relative flex flex-col" style={{ height: scrollContainerHeight }}>
          {testimonials.map((testimonial, index) => (
            <StickyTestimonialCard
              key={testimonial.name}
              index={index}
              testimonial={testimonial}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
