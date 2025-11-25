export interface PricePoint {
    price: number;
    date: string;
}

export interface TrackedItem {
    id: string;
    sku: string;
    name: string;
    link: string;
    retailPrice: number;
    originalPrice?: number;
    currentPrice: number | null;
    imageUrl?: string;
    priceHistory: PricePoint[];
    lastUpdated: string | null;
    alertTriggered: boolean;
}

export interface AlertMessage {
    id: number;
    sku: string;
    name: string;
    message: string;
    time: string;
    type: 'success' | 'alert' | 'update' | 'error';
}
