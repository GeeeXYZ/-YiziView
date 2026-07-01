export const getTheme = (themeName) => {
    const isCream = themeName === 'cream';

    return {
        isCream,
        // Base structure
        baseBg: isCream ? 'bg-[#F4F1EA]' : 'bg-[#121212]',
        baseText: isCream ? 'text-[#2C2825]' : 'text-white',
        mutedText: isCream ? 'text-[#7A756B]' : 'text-[#737373]',
        headerBg: isCream ? 'bg-[#EBE5D9]' : 'bg-[#1a1a1a]',

        // Cards (Full Color)
        cardMint: isCream ? 'bg-[#b6d7a8] text-[#274e13]' : 'bg-[#34d399] text-black',
        cardPurple: isCream ? 'bg-[#d9d2e9] text-[#351c75]' : 'bg-[#a78bfa] text-black',
        cardYellow: isCream ? 'bg-[#ffe599] text-[#7f6000]' : 'bg-[#fbbf24] text-black',
        cardBlue: isCream ? 'bg-[#c9daf8] text-[#0b5394]' : 'bg-[#60a5fa] text-black',
        cardCoral: isCream ? 'bg-[#f4cccc] text-[#990000]' : 'bg-[#f87171] text-black',
        cardNeutral: isCream ? 'bg-[#EBE5D9] text-[#2C2825]' : 'bg-[#262626] text-white',
        cardDark: isCream ? 'bg-[#DCD5C5] text-[#2C2825]' : 'bg-[#1a1a1a] text-white',

        // Inputs / Interactions
        inputBg: isCream ? 'bg-[#FDFBF7] text-[#2C2825]' : 'bg-[#262626] text-white',
        inputHover: isCream ? 'focus:bg-[#ffffff]' : 'focus:bg-[#333]',
        
        buttonHover: 'hover:scale-[1.02] active:scale-95 transition-all cursor-pointer',
        
        // Specific Elements
        tabActive: isCream ? 'bg-[#b6d7a8] text-[#274e13] font-bold' : 'bg-[#34d399] text-black font-bold',
        tabInactive: isCream ? 'bg-[#EBE5D9] text-[#7A756B] hover:text-[#2C2825] font-bold' : 'bg-[#262626] text-[#737373] hover:text-white hover:bg-[#404040] font-bold',
    };
};
