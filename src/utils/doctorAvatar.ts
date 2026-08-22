import React from 'react';

/**
 * Reliable doctor profile images & robust fallback handler
 */
export const DOCTOR_IMAGES: Record<string, string> = {
  'doc-1': 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
  'doc-2': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
  'doc-3': 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80',
  'doc-4': 'https://images.unsplash.com/photo-1594824813628-9a28dbd6c627?w=300&auto=format&fit=crop&q=80',
};

export const FALLBACK_FEMALE_DOCTOR_AVATAR =
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80';

export const FALLBACK_MALE_DOCTOR_AVATAR =
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80';

// SVG data URI fallback so a broken image icon NEVER renders even if network fails or offline
export const SVG_DOCTOR_FALLBACK = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="%23e0f2fe" rx="50"/><circle cx="50" cy="38" r="18" fill="%230284c7"/><path d="M22 84 C22 62 36 56 50 56 C64 56 78 62 78 84 Z" fill="%230369a1"/><rect x="46" y="24" width="8" height="18" fill="%23ffffff" rx="2"/><rect x="41" y="29" width="18" height="8" fill="%23ffffff" rx="2"/></svg>`;

/**
 * Returns a guaranteed valid avatar URL for a given doctor.
 * Automatically corrects the legacy broken URL or missing paths.
 */
export function getValidDoctorAvatar(doctorId?: string, currentAvatar?: string): string {
  if (doctorId && DOCTOR_IMAGES[doctorId]) {
    // If the avatar is missing, empty, or contains the known broken ID '1594824813589'
    if (!currentAvatar || currentAvatar.includes('1594824813589') || currentAvatar.trim() === '') {
      return DOCTOR_IMAGES[doctorId];
    }
  }
  if (currentAvatar && !currentAvatar.includes('1594824813589') && currentAvatar.trim() !== '') {
    return currentAvatar;
  }
  return doctorId === 'doc-2' || doctorId === 'doc-4'
    ? FALLBACK_FEMALE_DOCTOR_AVATAR
    : FALLBACK_MALE_DOCTOR_AVATAR;
}

/**
 * Image error handler that gracefully replaces any failed image with a valid doctor photo or fallback SVG.
 */
export function handleDoctorImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  doctorId?: string
) {
  const target = e.currentTarget;
  target.onerror = null; // Prevent infinite error loops
  
  if (doctorId && DOCTOR_IMAGES[doctorId] && target.src !== DOCTOR_IMAGES[doctorId]) {
    target.src = DOCTOR_IMAGES[doctorId];
  } else if (target.src !== SVG_DOCTOR_FALLBACK) {
    target.src = SVG_DOCTOR_FALLBACK;
  }
}
