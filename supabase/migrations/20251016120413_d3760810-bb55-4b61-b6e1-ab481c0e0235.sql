-- Create trigger to notify CEO when new order is created
CREATE TRIGGER on_new_order_notify_ceo
  AFTER INSERT ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();

-- Create trigger to notify customer when order is approved/rejected
CREATE TRIGGER on_order_decision_notify_customer
  AFTER UPDATE ON public.projects_v3
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_approval();