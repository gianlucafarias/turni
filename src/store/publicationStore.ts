import type { ProductData, Plan } from '../types/index';
import { showNotification } from '../utils/notifications';

class PublicationStore {
    private static instance: PublicationStore;
    private currentStep: number = 1;
    private productData: ProductData | null = null;
    private selectedPlan: Plan | null = null;
    private imagePreview: string | null = null;
    private stepChangeCallbacks: ((step: number) => void)[] = [];

    private constructor() {}

    static getInstance(): PublicationStore {
        if (!PublicationStore.instance) {
            PublicationStore.instance = new PublicationStore();
        }
        return PublicationStore.instance;
    }

    getCurrentStep(): number {
        return this.currentStep;
    }

    getSelectedPlan(): Plan | null {
        return this.selectedPlan;
    }

    getProductData(): ProductData | null {
        return this.productData;
    }

    getImagePreview(): string | null {
        return this.imagePreview;
    }

    setStep(step: number): void {
        if (step < 1 || step > 3) {
            showNotification('Paso inválido', 'error');
            return;
        }
        this.currentStep = step;
        this.notifyStepChange();
        
        // Ejecutar callbacks
        this.stepChangeCallbacks.forEach(callback => callback(step));
    }

    setProductData(data: ProductData): void {
        this.productData = data;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b0f55e3a-8eac-449f-96b7-3ed570a5511d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1',location:'src/store/publicationStore.ts:50',message:'setProductData called',data:{step:this.currentStep,hasWhatsapp:!!data.whatsapp,hasCaracteristicas:Array.isArray(data.caracteristicas)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
        showNotification('Información del producto guardada', 'success');
    }

    setPlan(plan: Partial<Plan>): void {
        const normalizedPlan: Plan = {
            id: plan.id || 'custom',
            nombre: plan.nombre || 'Plan personalizado',
            precio: plan.precio || 0,
            duracion: plan.duracion || '',
            caracteristicas: plan.caracteristicas || [],
            destacado: plan.destacado
        };

        this.selectedPlan = normalizedPlan;
        showNotification(`Plan ${normalizedPlan.nombre} seleccionado`, 'success');
    }

    setImagePreview(preview: string | null): void {
        this.imagePreview = preview;
    }

    reset(): void {
        this.currentStep = 1;
        this.productData = null;
        this.selectedPlan = null;
        this.imagePreview = null;
        this.notifyStepChange();
    }

    private notifyStepChange(): void {
        // Ocultar todos los pasos
        document.querySelectorAll('[id^="step-"]').forEach(el => {
            el.classList.add('hidden');
        });

        // Mostrar el paso actual
        const currentStepElement = document.getElementById(`step-${this.currentStep}`);
        if (currentStepElement) {
            currentStepElement.classList.remove('hidden');
        }

        // Actualizar la barra de progreso
        this.updateProgressBar();

        // Notificar el cambio
        const stepNames = ['Información', 'Plan', 'Pago'];
        showNotification(`Paso ${this.currentStep}: ${stepNames[this.currentStep - 1]}`, 'info');
    }

    private updateProgressBar(): void {
        const steps = document.querySelectorAll('.progress-step');
        const progressBars = document.querySelectorAll('.progress-bar');

        steps.forEach((step, index) => {
            if (index + 1 <= this.currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        progressBars.forEach((bar, index) => {
            if (index < this.currentStep - 1) {
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        });
    }

    async validateCurrentStep(): Promise<boolean> {
        switch (this.currentStep) {
            case 1:
                if (!this.productData) {
                    showNotification('Por favor complete la información del producto', 'error');
                    return false;
                }
                if (!this.imagePreview) {
                    showNotification('Por favor suba una imagen del producto', 'error');
                    return false;
                }
                return true;

            case 2:
                if (!this.selectedPlan) {
                    showNotification('Por favor seleccione un plan', 'error');
                    return false;
                }
                return true;

            case 3:
                // Validaciones del paso final si las hay
                return true;

            default:
                return false;
        }
    }

    onStepChange(callback: (step: number) => void): void {
        this.stepChangeCallbacks.push(callback);
    }
}

export const publicationStore = PublicationStore.getInstance(); 