import React from 'react';
import {
  CheckCircle2,
  Package,
  Truck,
  ShieldCheck,
  Clock,
  AlertCircle,
  XCircle,
  ChevronRight
} from 'lucide-react';

export type ShipmentStage = 'order_confirmed' | 'packaging' | 'in_transit' | 'delivered';

interface ShipmentProgressStepperProps {
  status: string; // e.g. 'pending_confirmation', 'confirmed', 'in_transit', 'delivered', 'verified', 'cancelled'
  carrier?: string;
  trackingNumber?: string;
  confirmedDate?: string;
  shippedDate?: string;
  deliveredDate?: string;
  eta?: string;
  compact?: boolean;
}

export default function ShipmentProgressStepper({
  status,
  carrier,
  trackingNumber,
  confirmedDate,
  shippedDate,
  deliveredDate,
  eta,
  compact = false
}: ShipmentProgressStepperProps) {
  const normStatus = (status || '').toLowerCase().replace('-', '_');

  // Handle cancelled / rejected early
  if (normStatus === 'cancelled' || normStatus === 'rejected') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
        <XCircle size={14} className="text-rose-600 shrink-0" />
        <span>Order Cancelled / Rejected</span>
      </div>
    );
  }

  // Determine stage index: 0 = Pending Review, 1 = Order Confirmed, 2 = Packaging, 3 = In Transit, 4 = Delivered
  let currentStageIndex = 0;
  if (normStatus === 'pending' || normStatus === 'pending_confirmation' || normStatus === 'draft') {
    currentStageIndex = 0; // Awaiting acceptance
  } else if (normStatus === 'confirmed' || normStatus === 'acknowledged' || normStatus === 'ordered') {
    currentStageIndex = 2; // Confirmed, currently packaging
  } else if (normStatus === 'preparing' || normStatus === 'packaging') {
    currentStageIndex = 2; // Packaging
  } else if (normStatus === 'in_transit' || normStatus === 'dispatched') {
    currentStageIndex = 3; // Dispatched, in transit
  } else if (normStatus === 'delivered' || normStatus === 'verified') {
    currentStageIndex = 4; // Delivered / Stocked
  }

  const steps = [
    {
      id: 1,
      name: 'Order Confirmed',
      shortName: 'Confirmed',
      icon: CheckCircle2,
      detail: confirmedDate ? new Date(confirmedDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'PO Accepted'
    },
    {
      id: 2,
      name: 'Packaging',
      shortName: 'Packaging',
      icon: Package,
      detail: currentStageIndex >= 2 ? 'Lot & Pack Allocated' : 'Prep Pending'
    },
    {
      id: 3,
      name: 'In Transit',
      shortName: 'In Transit',
      icon: Truck,
      detail: trackingNumber ? `${carrier || 'Carrier'}: ${trackingNumber}` : (eta ? `ETA: ${new Date(eta).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'Dispatch Pending')
    },
    {
      id: 4,
      name: 'Delivered',
      shortName: 'Delivered',
      icon: ShieldCheck,
      detail: deliveredDate ? new Date(deliveredDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : (normStatus === 'verified' ? 'Stock Verified' : 'Dock Receiving')
    }
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-[11px]">
        {steps.map((step, idx) => {
          const isDone = currentStageIndex >= step.id;
          const isCurrent = currentStageIndex === step.id - 1 && currentStageIndex !== 0;
          const StepIcon = step.icon;

          return (
            <React.Fragment key={step.id}>
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-bold transition-colors ${
                  isDone
                    ? 'bg-emerald-100 text-emerald-800'
                    : isCurrent
                    ? 'bg-blue-100 text-blue-800 animate-pulse'
                    : 'bg-slate-100 text-slate-400'
                }`}
                title={`${step.name}: ${step.detail}`}
              >
                <StepIcon size={12} />
                <span className="hidden sm:inline text-[10px]">{step.shortName}</span>
              </div>
              {idx < steps.length - 1 && (
                <span className={`text-[10px] font-black ${currentStageIndex > step.id ? 'text-emerald-500' : 'text-slate-300'}`}>
                  →
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Clock size={12} className="text-blue-600" />
          <span>Fulfillment Stage & Progress</span>
        </span>
        <span className="text-[10px] font-black tracking-wide px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
          {currentStageIndex === 0 && 'Stage: Pending Confirmation'}
          {currentStageIndex === 1 && 'Stage 1 of 4: Order Confirmed'}
          {currentStageIndex === 2 && 'Stage 2 of 4: Packaging & Allocation'}
          {currentStageIndex === 3 && 'Stage 3 of 4: In-Transit with Carrier'}
          {currentStageIndex === 4 && 'Stage 4 of 4: Delivered & Verified'}
        </span>
      </div>

      <div className="relative">
        {/* Connecting Progress Track */}
        <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-6 h-1 bg-slate-200 -z-0">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-600 transition-all duration-500"
            style={{
              width:
                currentStageIndex === 0
                  ? '0%'
                  : currentStageIndex === 1
                  ? '15%'
                  : currentStageIndex === 2
                  ? '48%'
                  : currentStageIndex === 3
                  ? '78%'
                  : '100%'
            }}
          />
        </div>

        {/* Step Nodes */}
        <div className="grid grid-cols-4 relative z-10">
          {steps.map((step) => {
            const isDone = currentStageIndex >= step.id;
            const isCurrent = (currentStageIndex === step.id - 1 && currentStageIndex !== 0) || (currentStageIndex === 0 && step.id === 1);
            const StepIcon = step.icon;

            return (
              <div key={step.id} className="flex flex-col items-center text-center px-1">
                {/* Step Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    isDone
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                      : isCurrent
                      ? 'bg-white border-blue-600 text-blue-600 ring-4 ring-blue-100 shadow-xs'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  <StepIcon size={14} className={isCurrent ? 'animate-pulse' : ''} />
                </div>

                {/* Step Label */}
                <span
                  className={`mt-2 text-[11px] font-black leading-tight ${
                    isDone
                      ? 'text-slate-900'
                      : isCurrent
                      ? 'text-blue-700'
                      : 'text-slate-400'
                  }`}
                >
                  {step.name}
                </span>

                {/* Step Description / Detail */}
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 line-clamp-1 max-w-[110px]">
                  {step.detail}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
