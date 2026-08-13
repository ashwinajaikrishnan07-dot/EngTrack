import React, { useState } from 'react';

// Top countries with their dial codes
const COUNTRIES = [
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India' },
  { code: 'US', dial: '+1',  flag: '🇺🇸', name: 'USA' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'UK' },
  { code: 'AU', dial: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: 'CA', dial: '+1',  flag: '🇨🇦', name: 'Canada' },
  { code: 'SG', dial: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: 'AE', dial: '+971',flag: '🇦🇪', name: 'UAE' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'JP', dial: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: 'BR', dial: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: 'ZA', dial: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: 'NG', dial: '+234',flag: '🇳🇬', name: 'Nigeria' },
  { code: 'PK', dial: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: 'BD', dial: '+880',flag: '🇧🇩', name: 'Bangladesh' },
  { code: 'LK', dial: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: 'MY', dial: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'PH', dial: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: 'ID', dial: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'NZ', dial: '+64', flag: '🇳🇿', name: 'New Zealand' },
];

/**
 * PhoneInput — country code dropdown + number field
 * Returns full E.164 number: +917904179377
 *
 * Props:
 *   value: string (full number with country code)
 *   onChange: (fullNumber: string) => void
 *   required: boolean
 *   placeholder: string
 *   className: string (extra classes for wrapper)
 */
export default function PhoneInput({ value = '', onChange, required = false, placeholder = '9876543210', className = '' }) {
  // Parse existing value into dial + local
  const parseValue = (v) => {
    if (!v) return { dial: '+91', local: '' };
    const country = COUNTRIES.find((c) => v.startsWith(c.dial));
    if (country) return { dial: country.dial, local: v.slice(country.dial.length) };
    return { dial: '+91', local: v.replace(/^\+\d{1,3}/, '') };
  };

  const parsed = parseValue(value);
  const [dial, setDial] = useState(parsed.dial);
  const [local, setLocal] = useState(parsed.local);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleDialChange = (newDial) => {
    setDial(newDial);
    setShowDropdown(false);
    const full = local ? `${newDial}${local}` : '';
    onChange(full);
  };

  const handleLocalChange = (e) => {
    // Only allow digits
    const digits = e.target.value.replace(/\D/g, '');
    setLocal(digits);
    const full = digits ? `${dial}${digits}` : '';
    onChange(full);
  };

  const selectedCountry = COUNTRIES.find((c) => c.dial === dial) || COUNTRIES[0];

  return (
    <div className={`relative flex ${className}`}>
      {/* Country code selector */}
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-r-0 border-gray-300 rounded-l-xl text-sm hover:bg-gray-50 transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 whitespace-nowrap"
      >
        <span className="text-base">{selectedCountry.flag}</span>
        <span className="text-gray-700 font-medium">{dial}</span>
        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Number input */}
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-r-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
        placeholder={placeholder}
        value={local}
        onChange={handleLocalChange}
        required={required && !local}
        maxLength={12}
      />

      {/* Dropdown */}
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
            {COUNTRIES.map((c) => (
              <button
                key={`${c.code}-${c.dial}`}
                type="button"
                onClick={() => handleDialChange(c.dial)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left ${dial === c.dial ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
              >
                <span className="text-base flex-shrink-0">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-gray-400 text-xs flex-shrink-0">{c.dial}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
