import ForgotPasswordForm from './ForgotPasswordForm';

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-card rounded-3xl shadow-xl overflow-hidden border border-border">
                <div className="p-8 text-center bg-blue-600">
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Moda<span className="text-blue-200">Zapotlanejo</span>
                    </h2>
                    <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Recuperar Contraseña</p>
                </div>
                
                <div className="p-8">
                    <ForgotPasswordForm />
                </div>
            </div>
        </div>
    );
}
