"""Case 684 real-browser regression tests. Uses isolated browser profiles only.
Run against any served base URL, including the deployed GitHub Pages site:
BASE_URL=http://127.0.0.1:8768/praia-digital-apps/ AXE_PATH=/tmp/axe.min.js python tests/browser_test.py
"""
import csv
import io
import json
import os
from pathlib import Path
import re
import sys
import time
import unittest
from urllib.parse import urljoin, urlparse
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BASE_URL','http://127.0.0.1:8768/praia-digital-apps/').rstrip('/')+'/'
OUT=Path(os.environ.get('QA_OUTPUT',str(ROOT/'test-results'/'browser')))
OUT.mkdir(parents=True,exist_ok=True)
BACKUP=json.loads((ROOT/'tests/fixtures/workspace.json').read_text())
APPS=['','property-planner','calendar-auditor','stay-splitter','trip-planner','local-guide']
NAMES=['Good plans start','Property Planner','Calendar Auditor','Stay Splitter','Trip Planner','Local Guide']
MATRIX=[]
A11Y=[]
LINKS=[]

class BrowserCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(headless=True,args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1440,'height':1000},locale='en-GB',timezone_id='UTC',accept_downloads=True)
        self.page=self.context.new_page();self.errors=[];self.bad_requests=[]
        self.page.set_default_timeout(7000)
        self.context.on('page',self.observe)
        self.observe(self.page)
        self.context.on('dialog',lambda d:d.accept())
    def observe(self,page):
        page.on('pageerror',lambda e:self.errors.append(str(e)))
        page.on('console',lambda m:self.errors.append(m.text) if m.type=='error' else None)
        page.on('response',lambda r:self.bad_requests.append((r.status,r.url)) if r.status>=400 and r.url.startswith(BASE) else None)
        page.on('requestfailed',lambda r:self.bad_requests.append(('failed',r.url)) if r.url.startswith(BASE) and r.failure!='net::ERR_ABORTED' else None)
    def tearDown(self):
        try:
            self.assertEqual(self.errors,[],f'Browser errors: {self.errors}')
            self.assertEqual(self.bad_requests,[],f'Failed internal requests: {self.bad_requests}')
        finally:
            self.context.close()
    def go(self,slug=''):
        response=self.page.goto(BASE+(slug.rstrip('/')+'/' if slug else ''),wait_until='load')
        self.assertEqual(response.status,200)
        expect(self.page.locator('h1')).to_be_visible()
        if slug: expect(self.page.locator('#workspace')).not_to_be_empty()
        return response
    def seed(self,keys=None):
        self.go()
        values={k:v for k,v in BACKUP['storage'].items() if keys is None or k.split('.')[-2] in keys}
        self.page.evaluate('(items)=>{for(const [k,v] of Object.entries(items))localStorage.setItem(k,v)}',values)
    def saved(self,key):
        return self.page.evaluate('(key)=>{const r=localStorage.getItem(`praia.case684.${key}.v1`);return r?JSON.parse(r).data:null}',key)
    def action(self,name):
        return self.page.locator(f'#workspace [data-action="{name}"]').first
    def modal(self):
        return self.page.locator('dialog#editor')
    def save(self):
        self.modal().get_by_role('button',name='Save changes',exact=True).click()
        expect(self.modal()).not_to_be_visible()
    def download(self,trigger):
        with self.page.expect_download() as event: trigger()
        item=event.value
        target=OUT/(self._testMethodName+'-'+item.suggested_filename)
        item.save_as(target)
        self.assertGreater(target.stat().st_size,0)
        return target.read_text(encoding='utf-8-sig')
    def import_ics(self,content,name='qa-calendar.ics'):
        payload=content if isinstance(content,bytes) else content.encode()
        self.page.locator('#ics-file').set_input_files({'name':name,'mimeType':'text/calendar','buffer':payload})
        self.page.wait_for_timeout(100)
    def create_property(self,name='QA Harbor Loft'):
        self.action('add').click();m=self.modal()
        m.locator('#f-name').fill(name);m.locator('#f-location').fill('QA Coastal City')
        m.locator('#f-price').fill('250000.00');m.locator('#f-size').fill('90')
        m.locator('#f-description').fill('User-entered QA amenities');m.locator('#f-notes').fill('QA personal note')
        for i in range(5):m.locator(f'input[name="rating-criterion-{i}"]').fill('8')
        self.save()
    def create_group(self,name='QA Group'):
        self.action('new-group').click();m=self.modal()
        m.locator('#f-name').fill(name);m.locator('#f-people').fill('Alex, Sam, Taylor');self.save()
    def create_trip(self):
        self.action('new-trip').click();m=self.modal()
        m.locator('#f-name').fill('QA Coastal Weekend');m.locator('#f-destination').fill('QA Coastal City')
        m.locator('#f-start').fill('2026-11-16');m.locator('#f-end').fill('2026-11-18');self.save()
    def add_activity(self,title='QA Walk',cost='12.34'):
        self.action('add-activity').click();m=self.modal()
        m.locator('#f-title').fill(title);m.locator('#f-time').fill('09:00');m.locator('#f-duration').fill('60')
        m.locator('#f-cost').fill(cost);m.locator('#f-notes').fill('QA activity note');self.save()

class FeatureTests(BrowserCase):
    def test_property_crud_comparison_scores_favorites_exports(self):
        self.go('property-planner');self.action('add').click()
        self.modal().get_by_role('button',name='Save changes',exact=True).click()
        self.assertGreater(self.modal().locator(':invalid').count(),0)
        self.modal().get_by_role('button',name='Cancel',exact=True).click()
        self.create_property()
        self.create_property('QA Garden Flat')
        self.assertEqual(len(self.saved('property')['properties']),2)
        self.assertIn('80.0',self.page.locator('.stat').last.inner_text())
        self.page.get_by_role('checkbox',name='Compare QA Harbor Loft',exact=True).check()
        self.page.get_by_role('checkbox',name='Compare QA Garden Flat',exact=True).check()
        expect(self.page.locator('.comparison')).to_be_visible()
        self.assertEqual(self.page.locator('.comparison th').count(),3)
        self.page.get_by_role('button',name='Favorite QA Harbor Loft',exact=True).click()
        self.action('favorites').click();self.assertEqual(self.page.locator('.item-card').count(),1)
        self.action('edit').click();self.modal().locator('#f-notes').fill('Edited note survives reload');self.save()
        report=json.loads(self.download(lambda:self.action('json').click()))
        self.assertEqual(len(report['properties']),2);self.assertEqual(report['properties'][0]['score'],80)
        rows=list(csv.reader(io.StringIO(self.download(lambda:self.action('csv').click()))))
        self.assertEqual(len(rows),3);self.assertIn('Notes',rows[0])
        self.page.reload(wait_until='networkidle');self.assertIn('Edited note survives reload',self.page.locator('#workspace').inner_text())
        self.page.get_by_role('button',name='Delete QA Garden Flat',exact=True).click()
        self.assertEqual(len(self.saved('property')['properties']),1)

    def test_property_custom_criteria_validation_and_reranking(self):
        self.seed(['property']);self.go('property-planner');self.action('criteria').click()
        for item in self.modal().locator('input[name^="weight-"]').all():item.fill('0')
        self.modal().get_by_role('button',name='Save changes',exact=True).click()
        expect(self.modal().locator('#form-error')).to_contain_text('positive')
        self.modal().locator('input[name="weight-criterion-0"]').fill('100')
        self.modal().get_by_role('button',name='Add criterion',exact=True).click()
        last=self.modal().locator('.criteria-row').last;last.locator('input[name^="name-"]').fill('Internet')
        last.locator('input[name^="weight-"]').fill('50');self.save()
        self.assertEqual(len(self.saved('property')['criteria']),6)
        self.assertIn('53.3',self.page.locator('.stat').last.inner_text())
        self.action('criteria').click();self.modal().get_by_role('button',name='Remove criterion Internet',exact=True).click();self.save()
        self.assertEqual(len(self.saved('property')['criteria']),5)

    def test_expense_equal_weighted_edit_delete_balances_exports(self):
        self.go('stay-splitter');self.create_group();self.action('add-expense').click();m=self.modal()
        m.locator('#f-title').fill('QA Lodging');m.locator('#f-amount').fill('100.01');m.get_by_label('Paid by',exact=True).select_option(label='Sam');self.save()
        g=self.saved('splitter')['groups'][0];self.assertEqual(g['expenses'][0]['amount'],10001)
        self.action('add-expense').click();m=self.modal();m.locator('#f-title').fill('QA Dinner');m.locator('#f-amount').fill('60.00')
        m.locator('#f-mode').select_option('weighted')
        for person,weight in [('Alex','1'),('Sam','2'),('Taylor','0')]:m.get_by_label(person,exact=True).fill(weight)
        self.save();report=json.loads(self.download(lambda:self.action('json').click()))
        self.assertEqual(sum(report['balancesInCents'].values()),0)
        self.assertEqual(sorted(report['balancesInCents'].values()),[-3333,666,2667])
        self.assertEqual(len(report['settlementsInCents']),2)
        self.page.get_by_role('button',name='Edit QA Dinner',exact=True).click();self.modal().locator('#f-amount').fill('90.00');self.save()
        self.assertIn('90',self.page.locator('#workspace').inner_text())
        text=self.download(lambda:self.action('csv').click());self.assertIn('Settlement amount',text);self.assertIn('QA Dinner',text)
        self.page.reload(wait_until='networkidle');self.assertEqual(len(self.saved('splitter')['groups'][0]['expenses']),2)
        self.page.get_by_role('button',name='Delete QA Dinner',exact=True).click();self.assertEqual(len(self.saved('splitter')['groups'][0]['expenses']),1)

    def test_participant_management_group_validation_and_currency_lock(self):
        self.go('stay-splitter');self.action('new-group').click();m=self.modal();m.locator('#f-name').fill('QA Group');m.locator('#f-people').fill('Alex, Alex')
        m.get_by_role('button',name='Save changes',exact=True).click();expect(m.locator('#form-error')).to_contain_text('unique')
        m.locator('#f-people').fill('Alex, Sam, Taylor');self.save()
        self.action('people').click();self.modal().locator('#f-newPeople').fill('Jordan');self.save()
        self.assertEqual(len(self.saved('splitter')['groups'][0]['people']),4)
        self.action('people').click();self.modal().get_by_role('button',name='Remove Jordan',exact=True).click();self.save()
        self.assertEqual(len(self.saved('splitter')['groups'][0]['people']),3)
        self.action('add-expense').click();m=self.modal();m.locator('#f-title').fill('QA Cost');m.locator('#f-amount').fill('1.00');self.save()
        self.action('people').click();expect(self.modal().get_by_role('button',name='Remove Alex',exact=True)).to_be_disabled()
        self.modal().get_by_role('button',name='Cancel',exact=True).click()
        self.action('edit-group').click();expect(self.modal().locator('#f-currency')).to_be_disabled();self.modal().locator('#f-name').fill('QA Renamed Group');self.save()
        self.create_group('QA Other Group');self.page.locator('#group-select').select_option(label='QA Renamed Group')
        self.assertEqual(len(self.saved('splitter')['groups']),2)
        self.action('delete-group').click();self.assertEqual(len(self.saved('splitter')['groups']),1)

    def test_trip_crud_move_budget_date_validation_and_all_exports(self):
        self.go('trip-planner');self.create_trip();self.add_activity('QA Walk','12.34')
        self.action('later').click();self.assertEqual(self.saved('trip')['trips'][0]['activities'][0]['date'],'2026-11-17')
        self.action('edit-activity').click();m=self.modal();m.locator('#f-cost').fill('20.50');m.locator('#f-duration').fill('90');m.locator('#f-time').fill('09:30');self.save()
        self.assertIn('20.50',self.page.locator('.stat').last.inner_text())
        self.action('edit-trip').click();m=self.modal();m.locator('#f-end').fill('2026-11-16');m.get_by_role('button',name='Save changes',exact=True).click()
        expect(m.locator('#form-error')).to_contain_text('outside');m.get_by_role('button',name='Cancel',exact=True).click()
        report=json.loads(self.download(lambda:self.action('json').click()));self.assertEqual(report['trip']['activities'][0]['cost'],2050)
        self.assertIn('QA Walk',self.download(lambda:self.action('csv').click()))
        ics=self.download(lambda:self.action('ics').click());self.assertIn('BEGIN:VEVENT',ics);self.assertIn('DTSTART:20261117T093000Z',ics)
        self.page.reload(wait_until='networkidle');self.assertEqual(len(self.saved('trip')['trips'][0]['activities']),1)
        self.action('earlier').click();self.assertEqual(self.saved('trip')['trips'][0]['activities'][0]['date'],'2026-11-16')
        self.action('delete-activity').click();self.assertEqual(len(self.saved('trip')['trips'][0]['activities']),0)
        self.action('delete-trip').click();self.assertEqual(self.saved('trip')['trips'],[])

    def test_guide_crud_categories_collections_search_favorites_details_exports(self):
        self.go('local-guide');self.action('add').click();m=self.modal()
        m.locator('#f-name').fill('QA <b>Place</b>');m.locator('#f-location').fill('QA Coastal City');m.locator('#f-address').fill('QA test address')
        m.locator('#f-website').fill('https://example.org/');m.locator('#f-rating').select_option('5');m.locator('#f-collections').fill('Weekend, Food')
        m.locator('#f-info').fill('User-entered accessibility information');m.locator('#f-notes').fill('A personal QA note');self.save()
        self.assertEqual(self.page.locator('.item-card h3 b').count(),0)
        self.action('favorite').click();self.action('favorites').click();self.assertEqual(self.page.locator('.item-card').count(),1)
        self.page.locator('#place-search').fill('personal QA');self.page.locator('#category-filter').select_option(label='Restaurants');self.page.locator('#collection-filter').select_option(label='Food')
        self.assertEqual(self.page.locator('.item-card').count(),1)
        self.action('details').click();expect(self.modal()).to_contain_text('User-entered accessibility information')
        self.assertEqual(self.modal().get_by_role('link').get_attribute('href'),'https://example.org/');self.modal().get_by_role('button',name='Done',exact=True).click()
        report=json.loads(self.download(lambda:self.action('json').click()));self.assertEqual(report['collection'],'Food');self.assertEqual(len(report['places']),1)
        self.assertIn('Weekend; Food',self.download(lambda:self.action('csv').click()))
        self.action('edit').click();self.modal().locator('#f-rating').select_option('4');self.save()
        self.page.reload(wait_until='networkidle');self.assertEqual(self.saved('guide')['places'][0]['rating'],4)
        self.action('delete').click();self.assertEqual(self.saved('guide')['places'],[])

    def test_calendar_import_conflicts_gaps_filters_summaries_and_exports(self):
        self.go('calendar-auditor');self.import_ics((ROOT/'tests/fixtures/calendar.ics').read_bytes())
        self.assertEqual(len(self.saved('calendar')['events']),8)
        self.assertIn('2',self.page.locator('.stat').nth(1).inner_text())
        self.page.locator('#filter-from').fill('2026-11-16');self.page.locator('#filter-from').press('Tab')
        self.page.locator('#filter-to').fill('2026-11-16');self.page.locator('#filter-to').press('Tab')
        self.assertIn('5',self.page.locator('.stat').nth(0).inner_text());self.assertIn('3h 0m',self.page.locator('.stat').last.inner_text())
        self.page.locator('[data-tab="conflicts"]').click();expect(self.page.locator('#analysis-results')).to_contain_text('QA Meeting A')
        self.page.locator('[data-tab="gaps"]').click();expect(self.page.locator('#analysis-results')).to_contain_text('6h 0m')
        self.page.locator('[data-tab="events"]').click();expect(self.page.locator('#analysis-results')).to_contain_text('Available / transparent')
        report=json.loads(self.download(lambda:self.action('json').click()));self.assertEqual(report['conflictCount'],1);self.assertEqual(report['busyMinutes'],180)
        self.assertIn('QA Meeting A',self.download(lambda:self.action('csv').click()))
        self.action('reset').click();self.page.locator('[data-tab="summary"]').click();self.page.locator('#summary-mode').select_option('weekly')
        self.assertEqual(self.page.locator('#analysis-results tbody tr').count(),2)
        self.page.locator('#summary-mode').select_option('monthly');self.assertEqual(self.page.locator('#analysis-results tbody tr').count(),1)
        self.import_ics((ROOT/'tests/fixtures/calendar.ics').read_bytes());self.assertEqual(len(self.saved('calendar')['events']),8)
        self.page.reload(wait_until='networkidle');self.assertEqual(len(self.saved('calendar')['events']),8)
        self.page.locator('[data-tab="events"]').click();self.action('remove').click();self.assertEqual(len(self.saved('calendar')['events']),7)
        self.action('clear').click();self.assertEqual(self.saved('calendar')['events'],[])

    def test_calendar_bad_files_and_unsupported_series_leave_saved_data_safe(self):
        self.seed(['calendar']);self.go('calendar-auditor');before=self.saved('calendar')
        for name,content,expected in [('wrong.txt','not a calendar','.ics extension'),('broken.ics','BEGIN:VCALENDAR\nEND:VCALENDAR','No VEVENT'),('large.ics',b' '* (2*1024*1024+1),'2 MB')]:
            self.import_ics(content,name);expect(self.page.locator('#import-error')).to_contain_text(expected);self.assertEqual(self.saved('calendar'),before)
        mixed='BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:valid\nDTSTART:20261116T130000Z\nDURATION:PT1H\nSUMMARY:QA valid record\nEND:VEVENT\nBEGIN:VEVENT\nUID:unsupported\nDTSTART:20261116T140000Z\nRRULE:FREQ=HOURLY;COUNT=3\nSUMMARY:QA unsupported record\nEND:VEVENT\nEND:VCALENDAR'
        self.import_ics(mixed);self.assertEqual(len(self.saved('calendar')['warnings']),1)
        self.page.locator('#import-mode').select_option('replace');self.import_ics((ROOT/'tests/fixtures/calendar.ics').read_bytes())
        self.assertEqual(self.saved('calendar')['warnings'],[]);self.assertEqual(len(self.saved('calendar')['events']),8)

    def test_real_property_place_trip_expense_calendar_handoffs(self):
        self.go('property-planner');self.create_property();self.page.locator('.item-card').get_by_role('link',name='Plan a visit').click()
        self.assertIn('/trip-planner/?property=',self.page.url);self.action('handoff').click();m=self.modal()
        expect(m.locator('#f-name')).to_have_value('Visit QA Harbor Loft');m.locator('#f-start').fill('2026-11-16');m.locator('#f-end').fill('2026-11-18');self.save()
        expect(self.modal()).to_be_visible();expect(self.modal().locator('#f-title')).to_have_value('Visit QA Harbor Loft')
        self.modal().locator('#f-cost').fill('15.00');self.save()
        self.page.get_by_role('link',name='Add saved places',exact=True).click();self.action('add').click();m=self.modal()
        m.locator('#f-name').fill('QA User-entered Place');m.locator('#f-location').fill('QA Coastal City');m.locator('#f-notes').fill('Shared QA note');self.save()
        self.page.locator('.item-card').get_by_role('link',name='Add to trip').click();self.action('handoff').click();m=self.modal()
        expect(m.locator('#f-title')).to_have_value('QA User-entered Place');expect(m.locator('#f-notes')).to_have_value('Shared QA note');m.locator('#f-cost').fill('25.00');self.save()
        self.assertEqual(len(self.saved('trip')['trips'][0]['activities']),2)
        self.page.get_by_role('link',name='Split planned costs',exact=True).click();self.create_group('QA Coastal Cost Group')
        self.action('import-cost').click();m=self.modal();self.assertIn(m.locator('#f-amount').input_value(),['15.00','25.00']);self.save()
        self.assertTrue(self.saved('splitter')['groups'][0]['expenses'][0]['source'].startswith('trip:'))
        self.assertEqual(self.page.locator('#planned-cost option').count(),1)
        self.page.get_by_role('link',name='Back to trip',exact=True).click();self.page.get_by_role('link',name='Audit these dates',exact=True).click()
        self.action('sync').click();self.assertEqual(len(self.saved('calendar')['events']),2)
        conflict='BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:external\nDTSTART:20261116T100000Z\nDTEND:20261116T110000Z\nSUMMARY:QA Calendar Commitment\nEND:VEVENT\nEND:VCALENDAR'
        self.import_ics(conflict);self.assertEqual(len(self.saved('calendar')['events']),3)
        self.assertEqual(json.loads(self.download(lambda:self.action('json').click()))['conflictCount'],3)
        self.action('sync').click();self.assertEqual(len(self.saved('calendar')['events']),3)
        self.assertEqual(len(self.saved('property')['properties']),1);self.assertEqual(len(self.saved('guide')['places']),1)

    def test_hub_search_filters_featured_and_workspace_export(self):
        self.seed();self.go();self.assertEqual(self.page.locator('.app-card').count(),5)
        expect(self.page.locator('.app-card .badge.featured')).to_be_visible()
        self.page.locator('#app-search').fill('Calendar Auditor');self.assertEqual(self.page.locator('.app-card').count(),1)
        self.page.locator('#app-search').fill('no-matching-tool');expect(self.page.locator('#app-grid')).to_contain_text('No tools found')
        self.page.locator('#app-search').fill('');self.page.locator('[data-filter="Plan"]').click();self.assertEqual(self.page.locator('.app-card').count(),2)
        self.page.locator('[data-filter="Explore"]').click();self.assertEqual(self.page.locator('.app-card').count(),1)
        self.page.locator('[data-filter="All tools"]').click()
        report=json.loads(self.download(lambda:self.page.locator('#workspace-export').click()))
        self.assertEqual(report['format'],'praia-digital-apps');self.assertEqual(len(report['storage']),5)

class StorageTests(BrowserCase):
    def test_workspace_backup_restore_roundtrip_preserves_all_five_apps(self):
        self.seed();self.go();text=self.download(lambda:self.page.locator('#workspace-export').click())
        self.page.evaluate('localStorage.clear()');self.page.reload(wait_until='networkidle')
        self.page.locator('#workspace-import').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':text.encode()})
        for key,raw in BACKUP['storage'].items():self.assertEqual(self.saved(key.split('.')[-2]),json.loads(raw)['data'])
        self.page.reload(wait_until='networkidle');self.assertIn('saved items',self.page.locator('.workspace-card').inner_text())

    def test_corrupt_storage_is_not_overwritten_and_raw_backup_is_available(self):
        self.go();self.page.evaluate("localStorage.setItem('praia.case684.property.v1','{corrupt original')")
        self.go('property-planner');self.action('add').click();m=self.modal()
        m.locator('#f-name').fill('QA New');m.locator('#f-location').fill('QA City');m.locator('#f-price').fill('1.00')
        m.get_by_role('button',name='Save changes',exact=True).click();expect(m.locator('#form-error')).to_contain_text('blocked')
        self.assertEqual(self.page.evaluate("localStorage.getItem('praia.case684.property.v1')"),'{corrupt original')
        m.get_by_role('button',name='Cancel',exact=True).click();self.go();report=json.loads(self.download(lambda:self.page.locator('#workspace-export').click()))
        self.assertEqual(report['storage']['praia.case684.property.v1'],'{corrupt original')
        self.page.locator('#workspace-import').set_input_files(ROOT/'tests/fixtures/workspace.json')
        expect(self.page.locator('#toast')).to_contain_text('Restored 5')
        self.go('property-planner');self.action('favorite').click();self.assertIsInstance(self.saved('property'),dict)

    def test_two_tabs_cannot_silently_overwrite_newer_saved_data(self):
        self.seed(['property']);self.go('property-planner')
        other=self.context.new_page();other.goto(BASE+'property-planner/',wait_until='networkidle')
        self.action('favorite').click();before=self.saved('property')
        other.locator('[data-action="favorite"]').first.click();expect(other.locator('#toast')).to_contain_text('another tab')
        self.assertEqual(self.saved('property'),before);other.close()

    def test_storage_quota_failure_rolls_back_memory_and_does_not_report_success(self):
        self.seed(['property']);self.go('property-planner');before=self.saved('property')
        self.page.evaluate("""()=>{window.qaOriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='praia.case684.property.v1')throw new DOMException('Full','QuotaExceededError');return window.qaOriginalSet.call(this,k,v)}}""")
        self.action('favorite').click();expect(self.page.locator('#toast')).to_contain_text('could not be saved');self.assertEqual(self.saved('property'),before)
        self.page.evaluate('()=>{Storage.prototype.setItem=window.qaOriginalSet;}')
        self.action('favorite').click();after=self.saved('property');self.assertEqual(after['properties'][0]['favorite'],not before['properties'][0]['favorite'])

    def test_invalid_or_partially_failed_restore_never_leaves_half_a_workspace(self):
        self.seed();self.go();before=self.page.evaluate('Object.fromEntries(Object.entries(localStorage))')
        bad=json.loads(json.dumps(BACKUP));bad['storage']['praia.case684.trip.v1']='{}'
        self.page.locator('#workspace-import').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
        expect(self.page.locator('#toast')).to_contain_text('Unsupported storage version');self.assertEqual(self.page.evaluate('Object.fromEntries(Object.entries(localStorage))'),before)
        self.page.evaluate("""()=>{window.qaOriginalSet=Storage.prototype.setItem;window.qaRestoreWrites=0;Storage.prototype.setItem=function(k,v){window.qaRestoreWrites++;if(window.qaRestoreWrites===2)throw new DOMException('Full','QuotaExceededError');return window.qaOriginalSet.call(this,k,v)}}""")
        self.page.locator('#workspace-import').set_input_files(ROOT/'tests/fixtures/workspace.json')
        expect(self.page.locator('#toast')).to_contain_text('Previous workspace data was restored');self.assertEqual(self.page.evaluate('Object.fromEntries(Object.entries(localStorage))'),before)
        self.page.evaluate('()=>{Storage.prototype.setItem=window.qaOriginalSet;}')

class SurfaceTests(BrowserCase):
    def test_direct_entry_refresh_paths_internal_links_and_loaded_assets(self):
        self.seed();targets=set();assets=set()
        for slug,name in zip(APPS,NAMES):
            self.go(slug);self.assertIn(name,self.page.locator('h1').inner_text())
            self.page.reload(wait_until='networkidle');expect(self.page.locator('h1')).to_be_visible()
            links=self.page.locator('a[href]').evaluate_all('(els)=>els.map(a=>({url:a.href,hash:a.hash}))')
            for link in links:
                u=urlparse(link['url'])
                if u.netloc==urlparse(BASE).netloc:
                    self.assertTrue(u.path.startswith(urlparse(BASE).path),link['url'])
                    if link['hash'] and u.path==urlparse(self.page.url).path:self.assertEqual(self.page.locator(link['hash']).count(),1)
                    targets.add(link['url'].split('#')[0])
            assets.update(self.page.locator('script[src],link[href]').evaluate_all('(els)=>els.map(e=>e.src||e.href)'))
            self.assertEqual(self.page.locator('#site-footer nav a').count(),5)
            self.assertEqual(self.page.locator('#primary-nav a').count(),6)
        for url in sorted(targets|assets):
            response=self.context.request.get(url);self.assertEqual(response.status,200,url);LINKS.append({'url':url,'http':response.status})
        self.assertEqual(len(APPS),6)

    def test_mobile_tablet_desktop_populated_layouts_and_navigation(self):
        self.seed()
        for width,height in [(375,812),(768,1024),(1440,1000)]:
            self.page.set_viewport_size({'width':width,'height':height})
            for slug in APPS:
                self.go(slug)
                overflow=self.page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                self.assertFalse(overflow,f'{slug or "hub"} overflows at {width}px')
                if width<900:
                    toggle=self.page.locator('#nav-toggle');expect(toggle).to_be_visible();toggle.click()
                    expect(self.page.locator('#primary-nav')).to_be_visible();self.assertEqual(self.page.locator('#primary-nav a:visible').count(),6)
                    self.page.locator('#primary-nav a').first.focus();self.page.keyboard.press('Escape');expect(toggle).to_have_attribute('aria-expanded','false')
                if os.environ.get('QA_SCREENSHOTS','1')=='1':self.page.screenshot(path=str(OUT/f'{slug or "hub"}-{width}.png'),full_page=True)
                MATRIX.append({'page':slug or 'hub','viewport':[width,height],'populated':True,'overflow':overflow,'navigation':'passed'})

    def test_wcag_axe_on_all_pages_and_edit_dialogs(self):
        axe=Path(os.environ.get('AXE_PATH','/tmp/praia-axe-4.10.3.min.js'))
        self.assertTrue(axe.exists(),'Provide AXE_PATH; see tests/setup_qa.py')
        self.seed()
        for slug in APPS:
            self.go(slug);self.page.add_script_tag(path=str(axe))
            result=self.page.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))}")
            A11Y.append({'page':slug or 'hub','state':'populated','violations':result});self.assertEqual(result,[],json.dumps(result,indent=2))
            if slug and slug!='calendar-auditor':
                action={'property-planner':'add','stay-splitter':'add-expense','trip-planner':'add-activity','local-guide':'add'}[slug]
                self.action(action).click()
                result=self.page.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))}")
                A11Y.append({'page':slug,'state':'dialog','violations':result});self.assertEqual(result,[],json.dumps(result,indent=2));self.page.keyboard.press('Escape')

    def test_keyboard_skip_link_mobile_menu_dialog_focus_trap_and_escape(self):
        self.go('property-planner');self.page.keyboard.press('Tab');expect(self.page.locator('.skip-link')).to_be_focused()
        self.page.keyboard.press('Enter');expect(self.page.locator('#main')).to_be_focused()
        button=self.action('add');button.focus();self.page.keyboard.press('Enter');expect(self.modal()).to_be_visible()
        for _ in range(22):
            self.page.keyboard.press('Tab');self.assertTrue(self.page.evaluate('document.querySelector("dialog").contains(document.activeElement)'))
        self.page.keyboard.press('Escape');expect(self.modal()).not_to_be_visible();expect(button).to_be_focused()
        self.page.set_viewport_size({'width':375,'height':812});toggle=self.page.locator('#nav-toggle');toggle.focus();self.page.keyboard.press('Enter')
        expect(toggle).to_have_attribute('aria-expanded','true');expect(self.page.locator('#primary-nav a').first).to_be_focused();self.page.keyboard.press('Tab');expect(self.page.locator('#primary-nav a').nth(1)).to_be_focused()
        self.page.keyboard.press('Escape');expect(toggle).to_be_focused();expect(toggle).to_have_attribute('aria-expanded','false')

class RecordedResult(unittest.TextTestResult):
    def startTest(self,test):
        test._started=time.monotonic();super().startTest(test)
    def addSuccess(self,test):
        RECORDS.append({'test':test.id(),'result':'passed','seconds':round(time.monotonic()-test._started,3)});super().addSuccess(test)
    def addFailure(self,test,err):
        RECORDS.append({'test':test.id(),'result':'failed','error':self._exc_info_to_string(err,test)});super().addFailure(test,err)
    def addError(self,test,err):
        RECORDS.append({'test':test.id(),'result':'error','error':self._exc_info_to_string(err,test)});super().addError(test,err)
RECORDS=[]
if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromNames(sys.argv[1:],sys.modules[__name__]) if len(sys.argv)>1 else unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    run=unittest.TextTestRunner(verbosity=2,resultclass=RecordedResult).run(suite)
    (OUT/'results.json').write_text(json.dumps({'base_url':BASE,'browser':'Chromium','cases':RECORDS,'layout_matrix':MATRIX,'accessibility':A11Y,'internal_links_and_assets':LINKS,'tests_run':run.testsRun,'successful':run.wasSuccessful()},indent=2))
    sys.exit(0 if run.wasSuccessful() else 1)
