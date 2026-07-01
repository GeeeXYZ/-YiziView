export async function renderCardLayout(canvas, options) {
    const { images, aspectRatio, columns, gap, bgColor, logoText, showBadges } = options;
    if (!images || images.length === 0) return;

    const ctx = canvas.getContext('2d');
    
    // Base resolution per card
    const cardWidth = options.cardBaseWidth || 1200;
    const is3x4 = aspectRatio === '3:4';
    const cardHeight = is3x4 ? Math.round(cardWidth * 4 / 3) : Math.round(cardWidth * 16 / 9);
    
    const headerHeight = cardWidth * 0.15;
    const cornerRadiusPercent = (options.cornerRadius !== undefined ? options.cornerRadius : 4) / 100;
    const cornerRadius = cardWidth * cornerRadiusPercent;
    const badgeRadius = cardWidth * 0.06;
    
    // Calculate grid
    const rows = Math.ceil(images.length / columns);
    
    // Scale gap relative to card width to maintain proportions
    const scaledGap = (gap / 20) * (cardWidth * 0.05); // When UI gap=20, it's 5% of card width
    
    // Calculate total canvas size
    const padding = scaledGap * 2;
    canvas.width = padding * 2 + (cardWidth * columns) + (scaledGap * (columns - 1));
    canvas.height = padding * 2 + (cardHeight * rows) + (scaledGap * (rows - 1));
    
    // Fill global background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw each card
    for (let i = 0; i < images.length; i++) {
        const row = Math.floor(i / columns);
        const col = i % columns;
        
        const x = padding + col * (cardWidth + scaledGap);
        const y = padding + row * (cardHeight + scaledGap);
        
        // 1. Draw Card Base (White Rounded Rect)
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, cardWidth, cardHeight, cornerRadius);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.clip(); // Clip everything inside this card
        
        // 2. Draw Header Text & Logo
        // Subtitle Text (Right aligned, Red, Italic)
        ctx.font = `italic ${cardWidth * 0.035}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = options.logoColor || '#cc0000';
        ctx.fillText(logoText, x + cardWidth - cardWidth * 0.05, y + headerHeight / 2);
        
        // Custom Logo or Fallback Text
        if (options.logoDataUrl) {
            // Load custom logo image synchronously for drawing (we can preload it outside the loop to be efficient)
            // But since this function is already async, let's load it if not cached.
            if (!options._cachedLogoImg || options._cachedLogoImg.src !== options.logoDataUrl) {
                options._cachedLogoImg = await new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                    img.src = options.logoDataUrl;
                });
            }
            if (options._cachedLogoImg) {
                const customLogo = options._cachedLogoImg;
                const targetLogoHeight = headerHeight * 0.35; // Occupy 35% of header height
                const logoAspect = customLogo.width / customLogo.height;
                const logoWidth = targetLogoHeight * logoAspect;
                ctx.drawImage(customLogo, x + cardWidth * 0.05, y + (headerHeight - targetLogoHeight) / 2, logoWidth, targetLogoHeight);
            }
        } else {
            // Fallback simulated Logo: "YiZi Studio"
            ctx.fillStyle = '#000000';
            ctx.font = `bold italic ${cardWidth * 0.05}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText("YiZi Studio", x + cardWidth * 0.05, y + headerHeight / 2);
        }
        
        // 3. Draw Image (Crop-to-fit bottom section)
        const img = images[i];
        const imgAreaY = y + headerHeight;
        const imgAreaHeight = cardHeight - headerHeight;
        const imgAreaWidth = cardWidth;
        
        const imgAspect = img.width / img.height;
        const targetAspect = imgAreaWidth / imgAreaHeight;
        
        let sWidth = img.width;
        let sHeight = img.height;
        let sx = 0;
        let sy = 0;
        
        if (imgAspect > targetAspect) {
            // Image is wider than target
            sWidth = img.height * targetAspect;
            sx = (img.width - sWidth) / 2;
        } else {
            // Image is taller than target
            sHeight = img.width / targetAspect;
            sy = (img.height - sHeight) / 2;
        }
        
        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, imgAreaY, imgAreaWidth, imgAreaHeight);
        
        // Unclip to draw badges outside or over the clipped area (though clip is fine for badge too if we want it rounded, but reference shows it slightly protruding or just on top)
        ctx.restore(); 
        
        // 4. Draw Badges (A, B, C...)
        if (showBadges) {
            const badgeLetter = String.fromCharCode(65 + i); // 65 is 'A'
            const bx = x + badgeRadius * 1.5;
            const by = y + cardHeight - badgeRadius * 1.5;
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(bx, by, badgeRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#c52828'; // Red badge
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetY = 5;
            ctx.fill();
            
            // Badge Text
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold italic ${badgeRadius}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeLetter, bx - badgeRadius * 0.05, by + badgeRadius * 0.05); // slight optical adjustment
            ctx.restore();
        }
    }
}
