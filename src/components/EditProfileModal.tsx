import React, { useState, useEffect } from 'react';
import { PatientUser } from '../types';
import { playHospitalChime } from '../utils/audio';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PatientUser | null;
  onSaveProfile: (updatedProfile: PatientUser) => void;
  onShowToast: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

const COMMON_ALLERGIES = [
  'Penicillin',
  'Sulfa Drugs',
  'NSAIDs (Aspirin/Ibuprofen)',
  'Latex',
  'Contrast Dye',
  'Peanuts',
  'Dust Mites',
];

const COMMON_CONDITIONS = [
  'Type 2 Diabetes',
  'Hypertension',
  'Asthma / COPD',
  'Hypothyroidism',
  'Cardiac Arrhythmia',
  'Chronic Kidney Disease',
  'Arthritis',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveProfile,
  onShowToast,
}) => {
  const [name, setName] = useState<string>('');
  const [age, setAge] = useState<number>(35);
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bloodGroup, setBloodGroup] = useState<string>('B+');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [emergencyContactName, setEmergencyContactName] = useState<string>('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState<string>('');
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [newConditionInput, setNewConditionInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state whenever modal opens or currentUser changes
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setAge(currentUser.age || 30);
      setGender(currentUser.gender || 'Male');
      setBloodGroup(currentUser.bloodGroup || 'B+');
      setPhone(currentUser.phone || '');
      setEmail(currentUser.email || '');
      setEmergencyContactName(currentUser.emergencyContactName || '');
      setEmergencyContactPhone(currentUser.emergencyContactPhone || '');
      setAllergies(currentUser.allergies || []);
      setChronicConditions(currentUser.chronicConditions || []);
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const toggleAllergy = (allergy: string) => {
    if (allergies.includes(allergy)) {
      setAllergies(allergies.filter((a) => a !== allergy));
    } else {
      setAllergies([...allergies, allergy]);
    }
  };

  const handleAddCustomAllergy = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = newAllergyInput.trim();
    if (clean && !allergies.includes(clean)) {
      setAllergies([...allergies, clean]);
      setNewAllergyInput('');
    }
  };

  const removeAllergy = (item: string) => {
    setAllergies(allergies.filter((a) => a !== item));
  };

  const toggleCondition = (cond: string) => {
    if (chronicConditions.includes(cond)) {
      setChronicConditions(chronicConditions.filter((c) => c !== cond));
    } else {
      setChronicConditions([...chronicConditions, cond]);
    }
  };

  const handleAddCustomCondition = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = newConditionInput.trim();
    if (clean && !chronicConditions.includes(clean)) {
      setChronicConditions([...chronicConditions, clean]);
      setNewConditionInput('');
    }
  };

  const removeCondition = (item: string) => {
    setChronicConditions(chronicConditions.filter((c) => c !== item));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('Name Required', 'Please enter patient full name.', 'urgent');
      return;
    }

    setIsSubmitting(true);

    const updatedProfile: PatientUser = {
      ...currentUser,
      name: name.trim(),
      age: Number(age) || 30,
      gender,
      bloodGroup,
      phone: phone.trim() || currentUser.phone,
      email: email.trim() || currentUser.email,
      emergencyContactName: emergencyContactName.trim() || 'Next of Kin',
      emergencyContactPhone: emergencyContactPhone.trim() || '+91 99999 00000',
      allergies,
      chronicConditions,
    };

    setTimeout(() => {
      onSaveProfile(updatedProfile);
      setIsSubmitting(false);
      playHospitalChime();
      onShowToast(
        'Profile Saved',
        `Personal details updated for ${updatedProfile.name} (${updatedProfile.uhid}) and synced to Firestore.`,
        'success'
      );
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200 text-slate-700 max-h-[90vh] overflow-y-auto box-border">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center text-lg font-bold shadow-xs">
              <i className="fa-solid fa-user-pen"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                Edit Patient Personal Details
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                  UHID: {currentUser.uhid}
                </span>
                <span className="text-[11px] text-slate-500">Live Hospital EHR Record</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-base cursor-pointer p-1 shrink-0"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="py-4 space-y-4 text-xs">
          {/* Basic Demographics */}
          <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <i className="fa-solid fa-id-badge text-sky-500"></i>
              Primary Demographics
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajesh Mukherjee"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden cursor-pointer"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98200 55432"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-semibold rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-800 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
            <h4 className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <i className="fa-solid fa-phone-volume text-amber-600"></i>
              Emergency Next-of-Kin Contact
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Contact Person & Relationship
                </label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="e.g. Ananya Mukherjee (Spouse)"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-amber-300 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Emergency Phone
                </label>
                <input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  placeholder="+91 98200 11223"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-medium rounded-xl border border-amber-300 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Allergies & Drug Sensitivities */}
          <div className="space-y-3 bg-rose-50/60 p-4 rounded-2xl border border-rose-200">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-rose-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <i className="fa-solid fa-shield-halved text-rose-600"></i>
                Known Drug & Food Allergies
              </h4>
              <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded-full">
                High Clinical Safety Priority
              </span>
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_ALLERGIES.map((item) => {
                const selected = allergies.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAllergy(item)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer border ${
                      selected
                        ? 'bg-rose-500 text-white border-rose-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    {selected && <i className="fa-solid fa-check mr-1 text-[10px]"></i>}
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Custom Allergy Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newAllergyInput}
                onChange={(e) => setNewAllergyInput(e.target.value)}
                onKeyDown={handleAddCustomAllergy}
                placeholder="Add custom allergy (e.g. Ciprofloxacin)..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-rose-200 bg-white focus:border-rose-400 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCustomAllergy}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* Active Allergies List */}
            {allergies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allergies.map((alg) => (
                  <span
                    key={alg}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 font-bold text-[11px]"
                  >
                    <span>{alg}</span>
                    <button
                      type="button"
                      onClick={() => removeAllergy(alg)}
                      className="text-rose-700 hover:text-rose-900 cursor-pointer text-xs"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Chronic Conditions */}
          <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
            <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <i className="fa-solid fa-notes-medical text-sky-500"></i>
              Chronic Health Conditions & History
            </h4>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CONDITIONS.map((cond) => {
                const selected = chronicConditions.includes(cond);
                return (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => toggleCondition(cond)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition cursor-pointer border ${
                      selected
                        ? 'bg-sky-500 text-white border-sky-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50'
                    }`}
                  >
                    {selected && <i className="fa-solid fa-check mr-1 text-[10px]"></i>}
                    {cond}
                  </button>
                );
              })}
            </div>

            {/* Custom Condition Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newConditionInput}
                onChange={(e) => setNewConditionInput(e.target.value)}
                onKeyDown={handleAddCustomCondition}
                placeholder="Add other condition (e.g. Migraine)..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:border-sky-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCustomCondition}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* Active Conditions List */}
            {chronicConditions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {chronicConditions.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 font-bold text-[11px]"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => removeCondition(c)}
                      className="text-sky-700 hover:text-sky-900 cursor-pointer text-xs"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>Save Personal Details</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
