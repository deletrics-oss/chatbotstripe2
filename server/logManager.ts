
export async function logSystemEvent(
    category: string,
    level: string,
    message: string,
    details: any = null,
    userId: number | undefined = undefined,
    deviceId: string | undefined = undefined
) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${category.toUpperCase()}] [${level.toUpperCase()}] ${message}`);
    if (details) {
        console.log(JSON.stringify(details, null, 2));
    }
    // In a real implementation, this might save to a database table
}
