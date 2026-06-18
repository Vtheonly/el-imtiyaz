import { useState } from 'react';
import { Modal, Button } from '../common';

interface NewParentModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function NewParentModal({ open, onClose, onSaved }: NewParentModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [email, setEmail] = useState('');
  const [occupation, setOccupation] = useState('');
  const [relationship, setRelationship] = useState<'father' | 'mother' | 'guardian' | 'other'>('father');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      await window.elImtiyaz.parents.create({
        firstName,
        lastName,
        phone,
        altPhone: altPhone || undefined,
        email: email || undefined,
        occupation: occupation || undefined,
        relationship,
        address: line1 ? { line1, city: city || 'Algiers', country: 'Algeria' } : undefined,
        notes: notes || undefined
      });
      onSaved();
      onClose();
      setFirstName(''); setLastName(''); setPhone(''); setAltPhone(''); setEmail('');
      setOccupation(''); setRelationship('father'); setLine1(''); setCity(''); setNotes('');
    } catch (err) {
      alert(`Error creating parent: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Parent/Guardian"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || !firstName || !lastName || !phone}>
            {saving ? 'Creating…' : 'Create Parent'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>First Name</label>
            <input className="el-input" style={{ width: '100%' }} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Last Name</label>
            <input className="el-input" style={{ width: '100%' }} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Phone Number</label>
            <input className="el-input" style={{ width: '100%' }} placeholder="+213..." value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Alt Phone (Optional)</label>
            <input className="el-input" style={{ width: '100%' }} value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" className="el-input" style={{ width: '100%' }} placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Relationship</label>
            <div className="el-select" style={{ width: '100%' }}>
              <select value={relationship} onChange={(e: any) => setRelationship(e.target.value)} style={{ width: '100%' }}>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Occupation</label>
            <input className="el-input" style={{ width: '100%' }} value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>City</label>
            <input className="el-input" style={{ width: '100%' }} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Street Address</label>
          <input className="el-input" style={{ width: '100%' }} value={line1} onChange={(e) => setLine1(e.target.value)} />
        </div>

        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Notes</label>
          <textarea className="el-input" style={{ width: '100%', minHeight: 60, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}