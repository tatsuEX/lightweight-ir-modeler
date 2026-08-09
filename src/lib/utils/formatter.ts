export function formatNumber(value: number | null): string {
    if (value === null) {
        return '';
    }
	return new Intl.NumberFormat('ja-JP', { style: 'decimal' }).format(value);
}