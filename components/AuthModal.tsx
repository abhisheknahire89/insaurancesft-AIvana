import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTab?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'login' }) => {
    const [activeTab, setActiveTab] = useState<'login' | 'signup'>(defaultTab);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, signup } = useAuth();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (activeTab === 'login') {
                await login(email, password);
                // Already in the product, just close modal
            } else {
                await signup({ email, password, firstName, lastName, phone });
                // Already in the product, just close modal
            }
            onClose();
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative border border-opd-border text-opd-text-primary">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-opd-text-secondary hover:text-opd-primary transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8">
                    <h2 className="text-2xl font-bold font-lora text-opd-primary mb-6">
                        {activeTab === 'login' ? 'Welcome Back' : 'Get Started'}
                    </h2>

                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setActiveTab('login')}
                            className={`flex-1 py-2 px-4 rounded-lg font-semibold text-xs transition-colors ${activeTab === 'login'
                                ? 'bg-opd-primary text-white shadow-sm'
                                : 'bg-opd-input-bg text-opd-text-secondary border border-opd-border hover:bg-gray-50'
                                }`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setActiveTab('signup')}
                            className={`flex-1 py-2 px-4 rounded-lg font-semibold text-xs transition-colors ${activeTab === 'signup'
                                ? 'bg-opd-primary text-white shadow-sm'
                                : 'bg-opd-input-bg text-opd-text-secondary border border-opd-border hover:bg-gray-50'
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                        {activeTab === 'signup' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-opd-text-secondary mb-1">
                                            First Name
                                        </label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            required
                                            className="form-input"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-opd-text-secondary mb-1">
                                            Last Name
                                        </label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            required
                                            className="form-input"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-opd-text-secondary mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="form-input"
                            />
                        </div>

                        {activeTab === 'signup' && (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-opd-text-secondary mb-1">
                                    Phone (Optional)
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-opd-text-secondary mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="form-input"
                            />
                            {activeTab === 'signup' && (
                                <p className="text-[10px] text-opd-text-muted mt-1 font-semibold uppercase tracking-wider">Minimum 6 characters</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 bg-opd-primary text-white font-bold hover:bg-opd-primary-dark shadow-sm"
                        >
                            {loading ? 'Please wait...' : activeTab === 'login' ? 'Login' : 'Create Account'}
                        </button>
                    </form>

                    {activeTab === 'signup' && (
                        <p className="mt-4 text-[10px] text-opd-text-muted text-center font-medium leading-relaxed">
                            By signing up, you agree to our Terms of Service and Privacy Policy.
                            You'll get 10 free OPD cases per day.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
