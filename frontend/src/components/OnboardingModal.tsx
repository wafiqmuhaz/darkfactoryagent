import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import type { AuthState } from '../store';
import { Sparkles, ChevronRight, Check } from 'lucide-react';

const steps = [
  {
    title: 'Welcome to Dark Factory',
    content: 'The autonomous AI agent that builds, tests, and deplops your software. Let’s take a quick tour of your new workspace.',
  },
  {
    title: 'The Kanban Board',
    content: 'This is where the magic happens. Watch the Chief of Staff agent decompose your requirements into actionable tasks and move them through the columns as work is completed.',
  },
  {
    title: 'Customize Your View',
    content: 'We built a beautiful UI that you can customize. Use the theme switcher in the top right to toggle between Light, Dark, or System themes.',
  },
  {
    title: 'Stay Informed',
    content: 'Keep an eye on the Notification Bell in the header. Important updates, PR approvals, and budget alerts will appear there.',
  },
];

export const OnboardingModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const hasCompletedOnboarding = useAuthStore((state: AuthState) => state.hasCompletedOnboarding);
  const completeOnboarding = useAuthStore((state: AuthState) => state.completeOnboarding);

  useEffect(() => {
    // Show modal if user hasn't completed onboarding
    if (!hasCompletedOnboarding) {
      // Slight delay for better UX
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeOnboarding();
      setIsOpen(false);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="bg-background border border-border w-full max-w-md rounded-xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-content"
      >
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
        </div>
        
        <div className="text-center mb-8 h-24">
          <h2 id="onboarding-title" className="text-xl font-bold mb-2">
            {steps[currentStep].title}
          </h2>
          <p id="onboarding-content" className="text-muted-foreground text-sm">
            {steps[currentStep].content}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8" aria-hidden="true">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-primary' : 'bg-secondary'}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button 
            onClick={handleSkip}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            Skip Tour
          </button>
          
          <button 
            onClick={handleNext}
            className="flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors"
          >
            {currentStep === steps.length - 1 ? (
              <>Get Started <Check className="w-4 h-4" /></>
            ) : (
              <>Next <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
