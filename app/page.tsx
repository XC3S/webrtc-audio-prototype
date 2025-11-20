import VideoCall from "./components/VideoCall";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <main className="flex w-full flex-col items-center justify-center">
        <VideoCall />
        
        <p className="mt-8 text-center text-sm text-zinc-500">
          Open this in two different browser windows/tabs to test the call.
        </p>
      </main>
    </div>
  );
}
