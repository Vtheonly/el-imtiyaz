import { useState } from 'react';
import { Modal, Button } from '../common';
import { UserRole } from '@core/enums';

interface NewEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function NewEmployeeModal({ open, onClose, onSaved }: NewEmployeeModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.TEACHER);
  const [title, setTitle] = useState('');
  const [salary, setSalary] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      await window.elImtiyaz.employees.create({
        firstName,
        lastName,
        email: email || undefined,
        phone,
        role,
        title: title || undefined,
        salary: salary ? parseFloat(salary) : undefined
      });
      onSaved();
      onClose();
      setFirstName(''); setLastName(''); setEmail(''); setPhone('');
      setRole(UserRole.TEACHER); setTitle(''); setSalary('');
    } catch (err) {
      alert(`Error creating employee: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Employee"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || !firstName || !lastName || !phone}>
            {saving ? 'Creating…' : 'Create Employee'}
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
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" className="el-input" style={{ width: '100%' }} placeholder="staff@el-imtiyaz.dz" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>System Role</label>
            <div className="el-select" style={{ width: '100%' }}>
              <select value={role} onChange={(e: any) => setRole(e.target.value)} style={{ width: '100%' }}>
                <option value={UserRole.TEACHER}>Teacher</option>
                <option value={UserRole.ACCOUNTANT}>Accountant</option>
                <option value={UserRole.RECEPTIONIST}>Receptionist</option>
                <option value={UserRole.ADMINISTRATOR}>Administrator</option>
                <option value={UserRole.VIEWER}>Viewer Only</option>
              </select>
            </div>
          </div>
          <div>
            <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Professional Title</label>
            <input className="el-input" style={{ width: '100%' }} placeholder="e.g. Mathematics Teacher" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="el-stat__label" style={{ display: 'block', marginBottom: 6 }}>Salary (DZD - Optional)</label>
          <input type="number" className="el-input" style={{ width: '100%' }} value={salary} onChange={(e) => setSalary(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}