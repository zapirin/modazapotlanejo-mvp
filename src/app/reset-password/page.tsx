import { Suspense } from 'react';
import ResetPasswordForm from './ResetPasswordForm';

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-card rounded-3xl shadow-xl overflow-hidden border border-border">
                <div className="p-8 text-center bg-blue-600">
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Moda<span className="text-blue-200">Zapotlanejo</span>
                    </h2>
                    <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Restablecer Contraseña</p>
                </div>
                
                <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </div>
    );
}
