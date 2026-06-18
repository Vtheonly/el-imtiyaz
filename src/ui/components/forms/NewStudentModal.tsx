import { useState, useEffect } from 'react';
import { Modal, Button } from '../common';
import { Gender } from '@core/enums';

interface ParentOption {
  id: string;
  fullName: string;
  phone: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface NewStudentModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function NewStudentModal({ open, onClose, onSaved }: NewStudentModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.UNSPECIFIED);
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [primaryParentId, setPrimaryParentId] = useState('');
  const [classId, setClassId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [parents, setParents] = useState<ParentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [parentList, classList] = await Promise.all([
          window.elImtiyaz.parents.list({ pageSize: 500 }),
          window.elImtiyaz.classes.list()
        ]);
        setParents((parentList as any[]).map(p => ({ id: p.id.value, fullName: p.fullName, phone: p.phone })));
        setClasses((classList as any[]).map(c => ({ id: c.id.value, name: c.name })));
      } catch (err) {
        console.error('Failed to load options', err);
      }
    })();
  }, [open]);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !dateOfBirth || !primaryParentId || !line1) return;
    setSaving(true);
    try {
      await window.elImtiyaz.students.create({
        firstName,
        lastName,
        dateOfBirth,
        gender,
        parentIds: [primaryParentId],
        primaryParentId,
        address: {
          line1,
          city: city || 'Algiers',
          country: 'Algeria'
        },
        classId: classId || undefined,
        notes: notes || undefined
      });
      onSaved();
      onClose();
      setFirstName(''); setLastName(''); setDateOfBirth(''); setGender(Gender.UNSPECIFIED);
      setLine1(''); setCity(''); setPrimaryParentId(''); setClassId(''); setNotes('');
    } catch (err) {
      alert(`Error creating student: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register New Student"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || !firstName || !lastName || !dateOfBirth || !primaryParentId || !line1}>
            {saving ? 'Registering…' : 'Register Student'}
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
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Date of Birth</label>
            <input type="date" className="el-input" style={{ width: '100%' }} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Gender</label>
            <div className="el-select" style={{ width: '100%' }}>
              <select value={gender} onChange={(e: any) => setGender(e.target.value)} style={{ width: '100%' }}>
                <option value={Gender.UNSPECIFIED}>Select Gender</option>
                <option value={Gender.MALE}>Male</option>
                <option value={Gender.FEMALE}>Female</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Primary Parent/Guardian</label>
            <div className="el-select" style={{ width: '100%' }}>
              <select value={primaryParentId} onChange={(e) => setPrimaryParentId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Select Parent</option>
                {parents.map(p => (
                  <option key={p.id} value={p.id}>{p.fullName} ({p.phone})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Assign Class (Optional)</label>
            <div className="el-select" style={{ width: '100%' }}>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Unassigned</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Street Address</label>
            <input className="el-input" style={{ width: '100%' }} value={line1} onChange={(e) => setLine1(e.target.value)} />
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>City</label>
            <input className="el-input" style={{ width: '100%' }} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Notes</label>
          <textarea className="el-input" style={{ width: '100%', minHeight: 60, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}