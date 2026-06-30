import React from "react";
import { AlertCircle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "info" | "success";
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Ya",
  cancelText = "Batal",
  onConfirm,
  onCancel,
  variant = "danger",
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          iconColor: "text-red-500",
          iconBg: "bg-red-100",
          btnConfirm: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
        };
      case "info":
        return {
          iconColor: "text-blue-500",
          iconBg: "bg-blue-100",
          btnConfirm: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
        };
      case "success":
        return {
          iconColor: "text-green-500",
          iconBg: "bg-green-100",
          btnConfirm: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
      ></div>
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 overflow-hidden transform transition-all">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-500 focus:outline-none"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-start">
          <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${styles.iconBg} sm:mx-0 sm:h-10 sm:w-10`}>
            <AlertCircle className={`w-6 h-6 ${styles.iconColor}`} />
          </div>
          <div className="ml-4 mt-1 text-left">
            <h3 className="text-lg leading-6 font-semibold text-neutral-900">
              {title}
            </h3>
            <div className="mt-2">
              <p className="text-sm text-neutral-500">
                {message}
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex flex-row-reverse gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full inline-flex justify-center rounded-xl border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto sm:text-sm transition-colors ${styles.btnConfirm}`}
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full inline-flex justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-base font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto sm:text-sm transition-colors"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
