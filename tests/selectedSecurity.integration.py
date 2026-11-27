"""Read-only security regression test; run after lovable auth-session --self."""
import asyncio
from playwright.async_api import async_playwright
from lovable_playwright_defaults import signed_in_context


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await signed_in_context(browser)
        page = await context.new_page()
        await page.goto('http://localhost:8080/', wait_until='domcontentloaded')
        result = await page.evaluate('''async () => {
          const {supabase} = await import('/src/integrations/supabase/client.ts');
          const {data: {user}} = await supabase.auth.getUser();
          if (!user) throw new Error('Signed-in account required');
          const {data: roles, error: roleError} = await supabase.from('user_roles').select('role').eq('user_id', user.id);
          if (roleError) throw new Error('Cannot verify account roles');
          const manager = (roles || []).some(r => ['admin','ceo','general_manager'].includes(r.role));
          const [settings, templates, photos, setup] = await Promise.all([
            supabase.from('messenger_settings').select('id'),
            supabase.from('sms_templates').select('id'),
            supabase.from('profile_photos').select('user_id'),
            supabase.rpc('attach_activity_trigger', {p_table: 'nonexistent_security_test', p_module: 'test'})
          ]);
          return {manager, settingsError: !!settings.error, templatesError: !!templates.error,
            settingsCount: settings.data?.length, templatesCount: templates.data?.length,
            photosError: !!photos.error, foreignPhotos: (photos.data || []).filter(r => r.user_id !== user.id).length,
            setupDenied: setup.error?.code === '42501'};
        }''')
        assert result['setupDenied'], 'Signed-in callers must not install triggers'
        assert not result['settingsError'] and not result['templatesError'], 'Reads must be filtered, not broken'
        assert not result['photosError'], 'Profile gallery query must remain functional'
        if result['manager']:
            assert result['templatesCount'] > 0, 'Authorized management retains templates'
        else:
            assert result['settingsCount'] == 0, 'Ordinary users cannot read messenger settings'
            assert result['templatesCount'] == 0, 'Ordinary users cannot read templates'
            assert result['foreignPhotos'] == 0, 'Ordinary users cannot read other galleries'
        print('PASS: trigger setup denied; management reads and photo galleries are properly scoped')
        await browser.close()


asyncio.run(main())