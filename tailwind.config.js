/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js}'],
  safelist: [
    // Button sizing
    'w-12', 'h-12', 'w-6', 'h-6',
    // Colors
    'bg-blue-600', 'bg-blue-700', 'bg-gray-600', 'bg-gray-700', 'bg-red-600', 'bg-red-700', 'bg-green-600',
    'text-white',
    // Layout
    'rounded-full', 'flex', 'items-center', 'justify-center',
    // Effects
    'shadow-lg', 'shadow-xl', 'border-2', 'border-white/20', 'border-black/8', 'dark:border-white/8',
    // Hover states
    'hover:bg-blue-700', 'hover:bg-gray-700', 'hover:bg-red-700', 'hover:shadow-xl', 'hover:scale-110',
    // Transitions
    'transition-all', 'duration-200',
    // Container classes
    'w-80', 'w-72', 'h-44', 'mx-auto', 'relative', 'group',
    'bg-white/95', 'dark:bg-gray-800/95', 'backdrop-blur-xl',
    'rounded-xl', 'p-4', 'shadow-2xl',
    'bg-gray-100', 'dark:bg-white/5', 'rounded-lg',
    // Overlay
    'absolute', 'inset-0', 'gap-4', 'opacity-0', 'group-hover:opacity-100',
    'transition-opacity', 'bg-black/40', 'backdrop-blur-sm'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}