export default function DeliveryPanel() {
  return (
    <div className="h-full bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="animate-fade-in text-center">
        {/* Simple loading dots */}
        <div className="flex gap-1.5 justify-center mb-8">
          <span
            className="w-2 h-2 bg-black rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 bg-black rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 bg-black rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
        <h3 className="text-xl font-semibold text-black">
          Delivering your CV...
        </h3>
        <p className="mt-3 text-sm text-gray-400">
          Sit tight, we&apos;re working on it
        </p>
      </div>
    </div>
  );
}
