export const extractSKUFromLink = (link: string): string | null => {
    const match = link.match(/\/p\/(\d+)/);
    return match ? match[1] : null;
};

export const extractProductName = (link: string): string => {
    const match = link.match(/\/en\/([^/]+)\/([^/]+)\/p\/\d+/);
    if (match) {
        return match[2]
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    return 'Product';
};

export const isBelowThreshold = (currentPrice: number | null, retailPrice: number): boolean => {
    if (!currentPrice) return false;
    return currentPrice < (retailPrice * 0.5);
};

export const pricePercentage = (currentPrice: number | null, retailPrice: number): string | null => {
    if (!currentPrice) return null;
    return ((currentPrice / retailPrice) * 100).toFixed(1);
};
