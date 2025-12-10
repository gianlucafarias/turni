export interface DragEventWithFiles extends DragEvent {
    dataTransfer: DataTransfer;
}

export interface FormElements extends HTMLFormControlsCollection {
    nombre: HTMLInputElement;
    categoria: HTMLSelectElement;
    descripcion: HTMLTextAreaElement;
    precio: HTMLInputElement;
    precioAnterior: HTMLInputElement;
    stock: HTMLInputElement;
    whatsapp: HTMLInputElement;
    imagen: HTMLInputElement;
}

export interface ProductForm extends HTMLFormElement {
    elements: FormElements;
} 