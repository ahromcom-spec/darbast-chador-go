import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RatingCriteria {
  id: string;
  rating_type: string;
  key: string;
  title: string;
  description: string | null;
  weight: number;
  is_active: boolean;
}

export interface Rating {
  id: string;
  project_id: string;
  rating_type: string;
  rater_id: string;
  rated_id: string;
  overall_score: number;
  criteria_scores: Record<string, number>;
  comment: string | null;
  is_anonymous: boolean;
  is_verified: boolean;
  helpful_count: number;
  created_at: string;
  rater_name?: string;
  rated_name?: string;
}

export interface ReputationScore {
  id: string;
  user_id: string;
  overall_score: number;
  total_ratings: number;
  customer_score: number | null;
  contractor_score: number | null;
  staff_score: number | null;
  trust_level: string;
  verified_projects: number;
  last_calculated_at: string;
  full_name?: string;
}

// Hook برای دریافت معیارهای امتیازدهی
export const useRatingCriteria = (ratingType?: string) => {
  return useQuery({
    queryKey: ['rating-criteria', ratingType],
    queryFn: async () => {
      let query = supabase
        .from('rating_criteria')
        .select('*')
        .eq('is_active', true)
        .order('weight', { ascending: false });

      if (ratingType) {
        query = query.eq('rating_type', ratingType as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as RatingCriteria[];
    },
  });
};

// Hook برای دریافت امتیازات یک کاربر
export const useUserRatings = (userId: string) => {
  return useQuery({
    queryKey: ['user-ratings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          *,
          rater:profiles!ratings_rater_id_fkey(full_name),
          rated:profiles!ratings_rated_id_fkey(full_name)
        `)
        .eq('rated_id', userId)
        .eq('is_verified', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(rating => ({
        ...rating,
        rater_name: rating.rater?.full_name || 'ناشناس',
        rated_name: rating.rated?.full_name || 'کاربر',
      })) as Rating[];
    },
  });
};

// Hook برای دریافت امتیاز اعتبار کاربر
export const useReputationScore = (userId?: string) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['reputation-score', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from('reputation_scores')
        .select(`
          *,
          profiles!reputation_scores_user_id_fkey(full_name)
        `)
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;

      return {
        ...data,
        full_name: data.profiles?.full_name || 'کاربر',
      } as ReputationScore;
    },
    enabled: !!targetUserId,
  });
};

// Hook برای ثبت امتیاز جدید
export const useCreateRating = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rating: {
      project_id: string;
      rating_type: string;
      rated_id: string;
      overall_score: number;
      criteria_scores: Record<string, number>;
      comment?: string;
      is_anonymous?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('ratings')
        .insert([rating as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-ratings', variables.rated_id] });
      queryClient.invalidateQueries({ queryKey: ['reputation-score', variables.rated_id] });
      queryClient.invalidateQueries({ queryKey: ['project-ratings', variables.project_id] });
      toast.success('امتیاز شما با موفقیت ثبت شد');
    },
    onError: (error: any) => {
      console.error('Error creating rating:', error);
      if (error.code === '23505') {
        toast.error('شما قبلاً برای این پروژه امتیاز ثبت کرده‌اید');
      } else {
        toast.error('خطا در ثبت امتیاز');
      }
    },
  });
};

// Hook برای دریافت امتیازات یک پروژه
export const useProjectRatings = (projectId: string) => {
  return useQuery({
    queryKey: ['project-ratings', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          *,
          rater:profiles!ratings_rater_id_fkey(full_name),
          rated:profiles!ratings_rated_id_fkey(full_name)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(rating => ({
        ...rating,
        rater_name: rating.is_anonymous ? 'ناشناس' : (rating.rater?.full_name || 'کاربر'),
        rated_name: rating.rated?.full_name || 'کاربر',
      })) as Rating[];
    },
  });
};

// Hook برای رای مفید بودن
export const useVoteHelpful = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ratingId, isHelpful }: { ratingId: string; isHelpful: boolean }) => {
      const { data, error } = await supabase
        .from('rating_helpful_votes')
        .upsert([{ rating_id: ratingId, is_helpful: isHelpful } as any], {
          onConflict: 'rating_id,voter_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-ratings'] });
      queryClient.invalidateQueries({ queryKey: ['project-ratings'] });
    },
  });
};

// Hook برای لیست برترین کاربران
export const useTopRatedUsers = (limit: number = 10) => {
  return useQuery({
    queryKey: ['top-rated-users', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reputation_scores')
        .select(`
          *,
          profiles!reputation_scores_user_id_fkey(full_name, phone_number)
        `)
        .order('overall_score', { ascending: false })
        .order('total_ratings', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return (data || []).map(score => ({
        ...score,
        full_name: score.profiles?.full_name || 'کاربر',
      })) as ReputationScore[];
    },
  });
};
