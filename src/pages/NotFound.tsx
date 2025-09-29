import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-6xl font-bold text-primary">۴۰۴</h1>
          <p className="text-xl text-muted-foreground">متاسفانه صفحه مورد نظر یافت نشد</p>
          <Button asChild>
            <Link to="/" className="construction-gradient">
              بازگشت به صفحه اصلی
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
