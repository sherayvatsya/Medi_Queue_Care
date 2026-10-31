import React, { useMemo, useState } from 'react';
import { MapPin, RefreshCw, Search, Stethoscope, Clock, SlidersHorizontal, CircleDollarSign, Users, CalendarDays, ArrowRight, X, HeartPulse } from 'lucide-react';
import { Doctor, Patient, PatientUser } from '../types';
import { HospitalLocation, REAL_HOSPITALS_NETWORK, calculateHaversineDistance } from '../data/hospitalsData';
import { INITIAL_DOCTORS } from '../data/mockData';

interface Props {
  user: PatientUser;
  doctors: Doctor[];
  patients: Patient[];
  databaseConnected: boolean;
  onConfirm: (patient: Patient) => void;
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

type Recommendation = { hospital: HospitalLocation; doctor: Doctor; wait: number; distance: number; available: boolean; slots: string; queueLength: number };

const specialtyFor = (text: string) => {
  const s = text.toLowerCase();
  if (/chest|heart|palpitat|cardiac/.test(s)) return 'Cardiology';
  if (/knee|joint|bone|back pain|fracture|orthop/.test(s)) return 'Orthopedics';
  if (/cough|breath|asthma|lung|respirat/.test(s)) return 'Pulmonology';
  return 'General Medicine';
};

export const HospitalDiscovery: React.FC<Props> = ({ user, doctors, patients, databaseConnected, onConfirm, onShowToast }) => {
  const [symptoms, setSymptoms] = useState(user.initialSymptoms || '');
  const [symptomDuration, setSymptomDuration] = useState(user.symptomDuration || '');
  const [symptomSeverity, setSymptomSeverity] = useState('');
  const [location, setLocation] = useState('Mohali');
  const [specialty, setSpecialty] = useState('Any');
  const [maxDistance, setMaxDistance] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [comparing, setComparing] = useState<string[]>([]);
  const [refreshedAt, setRefreshedAt] = useState(new Date());

  const results = useMemo(() => {
    const inferred = specialtyFor(symptoms);
    const origin = REAL_HOSPITALS_NETWORK.find((h) => `${h.city} ${h.name} ${h.postalCode}`.toLowerCase().includes(location.toLowerCase())) || REAL_HOSPITALS_NETWORK[0];
    const rows: Recommendation[] = [];
    for (const doctor of doctors) {
      const hospital = REAL_HOSPITALS_NETWORK.find((h) => h.id === doctor.hospitalId) || REAL_HOSPITALS_NETWORK.find((h) => h.name === doctor.hospitalName);
      if (!hospital) continue;
      const activeQueue = patients.filter((p) => p.doctorId === doctor.id && (p.status === 'waiting' || p.status === 'in_consultation'));
      const queueLength = activeQueue.length;
      const configuredDuration = Number(doctor.avgConsultationTimeMin);
      const seededDuration = INITIAL_DOCTORS.find((item) => item.id === doctor.id)?.avgConsultationTimeMin || 0;
      const averageConsultationMinutes = configuredDuration > 0 ? configuredDuration : seededDuration;
      const wait = Math.max(0, queueLength * averageConsultationMinutes + (doctor.delayMinutes || 0));
      const distance = calculateHaversineDistance(origin.lat, origin.lng, hospital.lat, hospital.lng);
      const available = doctor.status === 'in_room' || doctor.status === 'running_late' || doctor.status === 'shifted_room';
      const slots = 'Not provided';
      if (specialty !== 'Any' && !`${doctor.department} ${doctor.specialty}`.toLowerCase().includes(specialty.toLowerCase())) continue;
      if (symptoms && inferred !== 'General Medicine' && !`${doctor.department} ${doctor.specialty}`.toLowerCase().includes(inferred.toLowerCase())) continue;
      if (location && !`${hospital.city} ${hospital.name} ${hospital.postalCode} ${hospital.state}`.toLowerCase().includes(location.toLowerCase()) && distance > 25) continue;
      if (maxDistance && distance > Number(maxDistance)) continue;
      if (availableOnly && !available) continue;
      rows.push({ hospital, doctor, wait, distance, available, slots, queueLength });
    }
    return rows.sort((a, b) => a.wait - b.wait || a.distance - b.distance);
  }, [doctors, patients, symptoms, location, specialty, maxDistance, availableOnly]);

  const submitBooking = () => {
    if (!selected) return;
    if (patients.some((p) => p.userId === user.id && (p.status === 'waiting' || p.status === 'in_consultation'))) {
      onShowToast?.('Active booking found', 'You already have an active queue booking. View your current patient pass first.', 'urgent'); return;
    }
    const related = patients.filter((p) => p.doctorId === selected.doctor.id && (p.status === 'waiting' || p.status === 'in_consultation'));
    const patientsAhead = related.length;
    const tokenPosition = patientsAhead + 1;
    const prefix = selected.doctor.department === 'Orthopedics' ? 'A' : selected.doctor.department === 'Cardiology' ? 'C' : selected.doctor.department === 'Pulmonology' ? 'P' : 'G';
    const patient: Patient = {
      id: `pat-${user.id}-${Date.now()}`, userId: user.id,
      tokenNumber: `${prefix}-${String(tokenPosition).padStart(2, '0')}-${Date.now().toString().slice(-3)}`,
      name: user.name, age: user.age, gender: user.gender, phone: user.phone, uhid: user.uhid,
      patientType: 'new', hospitalId: selected.hospital.id, hospitalName: selected.hospital.name,
      hospitalAddress: `${selected.hospital.address}, ${selected.hospital.city}`,
      department: selected.doctor.department, doctorId: selected.doctor.id, doctorName: selected.doctor.name,
      roomNumber: selected.doctor.roomNumber, opdBlock: selected.doctor.opdBlock, floor: selected.doctor.floor,
      symptoms: symptoms.trim() ? [symptoms.trim()] : [], duration: symptomDuration.trim() || undefined, triageCategory: 'standard', triageNotes: `Patient booked from hospital discovery.${symptomDuration.trim() ? ` Symptoms reported for ${symptomDuration.trim()}.` : ''}${symptomSeverity ? ` Patient-reported symptom severity: ${symptomSeverity}.` : ''}`,
      preTestRecommended: [], preTestOptIn: false, preTestStatus: 'not_required', queuePosition: patientsAhead,
      estimatedWaitMinutes: selected.wait, status: 'waiting', createdAt: new Date().toISOString(),
      appointmentDate: new Date().toLocaleDateString('en-GB'), appointmentTime: 'Queue booking',
      intakeSource: 'typed', consentGiven: true,
    };
    onConfirm(patient);
  };

  const toggleCompare = (id: string) => setComparing((prev) => {
    if (prev.includes(id)) return prev.filter((item) => item !== id);
    if (prev.length >= 3) {
      onShowToast?.('Comparison limit reached', 'Compare up to three doctors at a time.', 'info');
      return prev;
    }
    return [...prev, id];
  });
  const field = 'w-full rounded-xl border border-[#DCEBE3] bg-white/90 px-3 py-2.5 text-sm text-[#173B40] outline-none transition focus:border-[#087F78] focus:ring-2 focus:ring-[#087F78]/10';
  const compared = results.filter((row) => comparing.includes(row.doctor.id));

  return <main className="min-h-[75vh] bg-[#F4FBF6] px-4 py-6 text-[#173B40] sm:px-6 sm:py-8 lg:px-10">
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-2xl border border-[#DCEBE3] bg-white/85 p-5 shadow-[0_8px_30px_rgba(0,107,103,0.06)] backdrop-blur-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#087F78]">Welcome, {user.name}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173B40] sm:text-3xl">Find the Right Care for You</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#647875]">Tell us what’s going on and where you’d like to be seen.</p>
          </div>
          <span className="rounded-full border border-[#DCEBE3] bg-[#F4FBF6] px-3 py-1.5 text-xs font-medium text-[#647875]">Booking creates a token only after confirmation</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
          <label className="relative block sm:col-span-2 lg:col-span-1"><HeartPulse className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#087F78]" /><input className={`${field} pl-10`} aria-label="Symptoms" placeholder="Symptoms, e.g. knee pain or cough" value={symptoms} onChange={(event) => setSymptoms(event.target.value)} /></label>
          <input className={field} aria-label="Symptom duration" placeholder="Duration, e.g. 3 days" value={symptomDuration} onChange={(event) => setSymptomDuration(event.target.value)} />
          <label className="relative block"><MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#087F78]" /><input className={`${field} pl-10`} aria-label="Location" placeholder="City, area or PIN code" value={location} onChange={(event) => setLocation(event.target.value)} /></label>
          <button type="button" onClick={() => setRefreshedAt(new Date())} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#CBE9D8] bg-[#E8F8EF] px-4 py-2.5 text-sm font-semibold text-[#006B67] transition hover:bg-[#D9F1E3]"><RefreshCw className="h-4 w-4" />Refresh waits</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <label className="text-xs font-semibold text-[#647875]" htmlFor="symptom-severity">Self-reported severity</label>
          <select id="symptom-severity" className="rounded-lg border border-[#DCEBE3] bg-white/90 px-3 py-1.5 text-xs text-[#173B40] outline-none focus:border-[#087F78]" value={symptomSeverity} onChange={(event) => setSymptomSeverity(event.target.value)}>
            <option value="">Choose if you wish</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option>
          </select>
          <p className="text-[11px] text-[#647875]">Severity is recorded as reported and does not replace clinical triage.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#DCEBE3] bg-white/85 p-4 shadow-[0_4px_20px_rgba(0,107,103,0.04)] sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#173B40]"><SlidersHorizontal className="h-4 w-4 text-[#087F78]" /><h2>Refine your search</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-[#647875]">Specialty<select className={`${field} mt-1.5`} value={specialty} onChange={(event) => setSpecialty(event.target.value)}><option>Any</option>{['General Medicine', 'Cardiology', 'Orthopedics', 'Pulmonology'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-xs font-semibold text-[#647875]">Maximum consultation fee<div className="relative mt-1.5"><CircleDollarSign className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#94A3A0]" /><input className={`${field} cursor-not-allowed bg-[#F4FBF6] pl-9`} disabled type="text" placeholder="Fee data unavailable" aria-label="Maximum consultation fee unavailable" /></div></label>
          <label className="text-xs font-semibold text-[#647875]">Maximum distance<div className="relative mt-1.5"><MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#087F78]" /><input className={`${field} pl-9 pr-12`} type="number" min="0" placeholder="Any distance" value={maxDistance} onChange={(event) => setMaxDistance(event.target.value)} /><span className="pointer-events-none absolute right-3 top-3 text-xs text-[#647875]">km</span></div></label>
          <label className="flex min-h-10 items-center gap-2 self-end rounded-xl border border-[#DCEBE3] bg-[#F4FBF6] px-3 py-2.5 text-xs font-semibold text-[#173B40]"><input className="h-4 w-4 accent-[#087F78]" type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />Available doctors only</label>
        </div>
      </section>

      <section className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[#173B40]"><Search className="mr-2 inline h-4 w-4 text-[#087F78]" />{results.length} matching doctor{results.length === 1 ? '' : 's'} <span className="font-normal text-[#647875]">· sorted by shortest wait</span></p>
        <p className="max-w-3xl text-left text-[11px] text-[#647875] sm:text-right">{databaseConnected ? 'Waits use current doctor queue counts × average consultation duration.' : 'Demo queue estimates · live database is unavailable.'} Distances are approximate. Updated {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </section>

      {!results.length ? <div className="rounded-2xl border border-dashed border-[#CBE9D8] bg-white/85 p-10 text-center"><Stethoscope className="mx-auto h-9 w-9 text-[#087F78]" /><h2 className="mt-3 font-bold text-[#173B40]">No matching doctors found</h2><p className="mt-1 text-sm text-[#647875]">Try another location, symptom, or specialty.</p></div> : <div className="grid gap-4 md:grid-cols-2">{results.map((row) => {
        const isCompared = comparing.includes(row.doctor.id);
        return <article key={row.doctor.id} className={`rounded-2xl border bg-white/90 p-4 shadow-[0_4px_18px_rgba(0,107,103,0.045)] transition duration-200 hover:-translate-y-0.5 hover:border-[#A8D9C0] hover:shadow-[0_8px_24px_rgba(0,107,103,0.08)] sm:p-5 ${isCompared ? 'border-[#087F78] ring-1 ring-[#087F78]/15' : 'border-[#DCEBE3]'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="text-base font-bold leading-snug text-[#173B40]">{row.hospital.name}</h2><p className="mt-1 text-sm text-[#173B40]"><Stethoscope className="mr-1.5 inline h-4 w-4 text-[#087F78]" />{row.doctor.name}</p><p className="mt-0.5 text-xs text-[#647875]">{row.doctor.department}{row.doctor.specialty ? ` · ${row.doctor.specialty}` : ''}</p></div>
            <label className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${isCompared ? 'border-[#087F78] bg-[#E8F8EF] text-[#006B67]' : 'border-[#DCEBE3] bg-white text-[#647875] hover:border-[#A8D9C0]'}`}><input className="h-3.5 w-3.5 accent-[#087F78]" type="checkbox" checked={isCompared} onChange={() => toggleCompare(row.doctor.id)} />Compare</label>
          </div>
          <div className="mt-4 rounded-xl bg-[#E8F8EF] px-4 py-3"><div className="flex items-center justify-between gap-2"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-[#647875]">Estimated wait</p><p className="mt-0.5 text-2xl font-bold leading-none text-[#006B67]">{row.wait} <span className="text-sm font-semibold">min</span></p></div><div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#087F78]"><Clock className="h-5 w-5" /></div></div></div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
            <div className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-[#087F78]" /><div><p className="font-semibold text-[#173B40]">{row.queueLength}</p><p className="text-[#647875]">in queue</p></div></div>
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#087F78]" /><div><p className="font-semibold text-[#173B40]">{row.distance} km</p><p className="text-[#647875]">approx. distance</p></div></div>
            <div className="flex items-start gap-2"><CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-[#087F78]" /><div><p className="font-semibold text-[#173B40]">Not provided</p><p className="text-[#647875]">consultation fee</p></div></div>
            <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#087F78]" /><div><p className="font-semibold text-[#173B40]">{row.available ? row.slots : 'Unavailable'}</p><p className="text-[#647875]">appointment slots</p></div></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E0EBE5] pt-3"><p className="text-[11px] text-[#647875]">Fee and slot schedules are not connected.</p><button type="button" disabled={!row.available} onClick={() => setSelected(row)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#006B67] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#087F78] disabled:cursor-not-allowed disabled:opacity-45">Choose doctor<ArrowRight className="h-4 w-4" /></button></div>
        </article>;
      })}</div>}

      {compared.length > 0 && <section className="overflow-hidden rounded-2xl border border-[#DCEBE3] bg-white/90 shadow-[0_4px_18px_rgba(0,107,103,0.05)]">
        <div className="flex items-center justify-between border-b border-[#E0EBE5] px-4 py-3"><div><h2 className="font-bold text-[#173B40]">Compare doctors</h2><p className="text-xs text-[#647875]">Compare up to three options side by side.</p></div><button type="button" onClick={() => setComparing([])} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#647875] hover:bg-[#F4FBF6]" aria-label="Clear comparison"><X className="h-4 w-4" />Clear</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] border-collapse text-left text-xs"><thead><tr className="bg-[#F4FBF6] text-[#647875]"><th className="px-4 py-3 font-semibold">Details</th>{compared.map((row) => <th key={row.doctor.id} className="min-w-40 px-4 py-3 font-semibold text-[#173B40]">{row.hospital.shortName || row.hospital.name}</th>)}</tr></thead><tbody>{[
          ['Doctor & specialty', (row: Recommendation) => `${row.doctor.name} · ${row.doctor.department}`], ['Estimated wait', (row: Recommendation) => `${row.wait} min`], ['Queue length', (row: Recommendation) => String(row.queueLength)], ['Distance', (row: Recommendation) => `${row.distance} km`], ['Consultation fee', () => 'Not provided'], ['Appointment slots', (row: Recommendation) => row.available ? row.slots : 'Unavailable'],
        ].map(([label, value]) => <tr key={String(label)} className="border-t border-[#E0EBE5]"><th className="px-4 py-3 font-medium text-[#647875]">{String(label)}</th>{compared.map((row) => <td key={row.doctor.id} className={`px-4 py-3 text-[#173B40] ${label === 'Estimated wait' ? 'font-bold text-[#006B67]' : ''}`}>{(value as (item: Recommendation) => string)(row)}</td>)}</tr>)}</tbody></table></div>
      </section>}
    </div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173B40]/35 p-4 backdrop-blur-[2px]"><section role="dialog" aria-modal="true" aria-labelledby="booking-review-title" className="w-full max-w-lg rounded-2xl border border-[#DCEBE3] bg-white p-5 shadow-[0_18px_60px_rgba(0,107,103,0.18)] sm:p-6"><h2 id="booking-review-title" className="text-xl font-bold text-[#173B40]">Review your booking</h2><p className="mt-1 text-sm text-[#647875]">Confirm these details. Your queue token is created only after confirmation.</p><dl className="mt-5 space-y-3 rounded-xl bg-[#F4FBF6] p-4 text-sm"><div><dt className="text-xs text-[#647875]">Hospital</dt><dd className="font-semibold text-[#173B40]">{selected.hospital.name}</dd></div><div><dt className="text-xs text-[#647875]">Doctor</dt><dd className="font-semibold text-[#173B40]">{selected.doctor.name} · {selected.doctor.department}</dd></div><div><dt className="text-xs text-[#647875]">Estimated wait</dt><dd className="font-semibold text-[#006B67]">{selected.wait} minutes</dd></div><div><dt className="text-xs text-[#647875]">Consultation fee</dt><dd className="font-semibold text-[#173B40]">Not available in current database</dd></div><div><dt className="text-xs text-[#647875]">Symptoms and duration</dt><dd className="text-[#173B40]">{symptoms || 'Not provided'}{symptomDuration ? ` · ${symptomDuration}` : ''}</dd></div>{symptomSeverity && <div><dt className="text-xs text-[#647875]">Reported severity</dt><dd className="text-[#173B40]">{symptomSeverity}</dd></div>}</dl><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={() => setSelected(null)} className="min-h-11 flex-1 rounded-xl border border-[#DCEBE3] px-4 py-2.5 font-semibold text-[#173B40] hover:bg-[#F4FBF6]">Back</button><button type="button" onClick={submitBooking} className="min-h-11 flex-1 rounded-xl bg-[#006B67] px-4 py-2.5 font-semibold text-white transition hover:bg-[#087F78]">Confirm & get token</button></div></section></div>}
  </main>;
};
