import { Suspense } from 'react';
import ChatContent from './chat-content';

// Read the server configuration on each request, rather than freezing it at build time.
export const dynamic = 'force-dynamic';

export default function ChatPage() {
    const accessRequired = Boolean(process.env.AI_CHAT_ACCESS_SECRET?.trim());

    return (
        <Suspense fallback={
            <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-500">
                <div className="animate-pulse flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Initializing chat...</span>
                </div>
            </div>
        }>
            <ChatContent accessRequired={accessRequired} />
        </Suspense>
    );
}
