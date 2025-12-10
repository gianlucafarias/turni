export interface ButtonAction {
    type: string;
    payload?: any;
}

export interface ButtonProps {
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    disabled?: boolean;
    loading?: boolean;
    icon?: string;
    className?: string;
    id?: string;
    action?: ButtonAction;
} 