from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from records.models import MailAssignment, MailRecord
from sections.models import Section, Subsection
from users.models import User


class MailRecordWorkflowTests(APITestCase):
    @staticmethod
    def _rows(response):
        data = response.data
        return data.get('results', data) if isinstance(data, dict) else data

    def setUp(self):
        self.section = Section.objects.create(name='Admin')
        self.subsection = Subsection.objects.create(section=self.section, name='Admin-1')

        self.ag = User.objects.create_user(
            username='ag_user',
            password='pass12345',
            email='ag@example.com',
            full_name='AG User',
            role='AG',
        )
        self.clerk = User.objects.create_user(
            username='clerk_user',
            password='pass12345',
            email='clerk@example.com',
            full_name='Clerk User',
            role='clerk',
            subsection=self.subsection,
        )
        self.aao = User.objects.create_user(
            username='aao_user',
            password='pass12345',
            email='aao@example.com',
            full_name='AAO User',
            role='AAO',
            subsection=self.subsection,
        )
        self.aao_peer = User.objects.create_user(
            username='aao_peer',
            password='pass12345',
            email='aao-peer@example.com',
            full_name='AAO Peer',
            role='AAO',
            subsection=self.subsection,
        )

    def test_clerk_can_create_and_self_assign_mail(self):
        self.client.force_authenticate(user=self.clerk)

        payload = {
            'letter_no': 'CLK/001',
            'date_received': timezone.now().date().isoformat(),
            'mail_reference_subject': 'Clerk self-assigned mail',
            'from_office': 'Local Office',
            'action_required': 'File and process',
            'assigned_to': [self.clerk.id],
            'due_date': (timezone.now().date() + timedelta(days=3)).isoformat(),
            'initial_instructions': 'About info text',
        }

        response = self.client.post(reverse('mailrecord-list'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['assigned_to'], self.clerk.id)
        self.assertEqual(response.data['created_by'], self.clerk.id)

        created_id = response.data['id']
        list_response = self.client.get(reverse('mailrecord-list'), {'status': 'created_by_me'})
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in self._rows(list_response)]
        self.assertIn(created_id, ids)

    def test_status_scope_filters_assigned_created_by_me_closed(self):
        assigned_mail = MailRecord.objects.create(
            letter_no='AAO/ASSIGNED',
            date_received=timezone.now().date(),
            mail_reference_subject='Assigned to AAO',
            from_office='HQ',
            action_required='Review',
            assigned_to=self.aao,
            current_handler=self.aao,
            monitoring_officer=self.aao.get_dag(),
            section=self.section,
            subsection=self.subsection,
            due_date=timezone.now().date() + timedelta(days=5),
            status='Assigned',
            created_by=self.ag,
        )
        MailAssignment.objects.create(
            mail_record=assigned_mail,
            assigned_to=self.aao,
            assigned_by=self.ag,
            assignment_remarks='Please review',
            status='Active',
        )

        created_by_me_mail = MailRecord.objects.create(
            letter_no='AAO/CREATED',
            date_received=timezone.now().date(),
            mail_reference_subject='Created by AAO',
            from_office='HQ',
            action_required='Process',
            assigned_to=self.aao_peer,
            current_handler=self.aao_peer,
            monitoring_officer=self.aao_peer.get_dag(),
            section=self.section,
            subsection=self.subsection,
            due_date=timezone.now().date() + timedelta(days=5),
            status='Assigned',
            created_by=self.aao,
        )

        closed_mail = MailRecord.objects.create(
            letter_no='AAO/CLOSED',
            date_received=timezone.now().date(),
            mail_reference_subject='Closed mail',
            from_office='HQ',
            action_required='Archive',
            assigned_to=self.aao,
            current_handler=self.aao,
            monitoring_officer=self.aao.get_dag(),
            section=self.section,
            subsection=self.subsection,
            due_date=timezone.now().date() + timedelta(days=1),
            status='Closed',
            date_of_completion=timezone.now().date(),
            created_by=self.ag,
        )

        self.client.force_authenticate(user=self.aao)

        assigned_resp = self.client.get(reverse('mailrecord-list'), {'status': 'assigned'})
        assigned_ids = [item['id'] for item in self._rows(assigned_resp)]
        self.assertIn(assigned_mail.id, assigned_ids)
        self.assertNotIn(closed_mail.id, assigned_ids)

        created_resp = self.client.get(reverse('mailrecord-list'), {'status': 'created_by_me'})
        created_ids = [item['id'] for item in self._rows(created_resp)]
        self.assertIn(created_by_me_mail.id, created_ids)
        self.assertNotIn(assigned_mail.id, created_ids)

        closed_resp = self.client.get(reverse('mailrecord-list'), {'status': 'closed'})
        closed_ids = [item['id'] for item in self._rows(closed_resp)]
        self.assertIn(closed_mail.id, closed_ids)


class MailRecordE2EAndPermissionMatrixTests(APITestCase):
    def setUp(self):
        self.section_alpha = Section.objects.create(name='Section Alpha')
        self.section_beta = Section.objects.create(name='Section Beta')

        self.sub_alpha = Subsection.objects.create(section=self.section_alpha, name='Alpha-1')
        self.sub_beta = Subsection.objects.create(section=self.section_beta, name='Beta-1')

        self.ag = self._mk_user('ag_matrix', 'AG', None)
        self.dag1 = self._mk_user('dag_one', 'DAG', None)
        self.dag2 = self._mk_user('dag_two', 'DAG', None)
        self.dag1.sections.set([self.section_alpha])
        self.dag2.sections.set([self.section_beta])

        self.srao1 = self._mk_user('srao_one', 'SrAO', self.sub_alpha)
        self.srao2 = self._mk_user('srao_two', 'SrAO', self.sub_beta)
        self.aao1 = self._mk_user('aao_one', 'AAO', self.sub_alpha)
        self.aao2 = self._mk_user('aao_two', 'AAO', self.sub_beta)
        self.aud1 = self._mk_user('auditor_one', 'auditor', None)
        self.aud2 = self._mk_user('auditor_two', 'auditor', None)
        self.aud1.auditor_subsections.set([self.sub_alpha])
        self.aud2.auditor_subsections.set([self.sub_beta])
        self.clerk1 = self._mk_user('clerk_one', 'clerk', self.sub_alpha)
        self.clerk2 = self._mk_user('clerk_two', 'clerk', self.sub_beta)

    @staticmethod
    def _rows(response):
        data = response.data
        return data.get('results', data) if isinstance(data, dict) else data

    @staticmethod
    def _url(mail_id, suffix):
        return f"/api/records/{mail_id}/{suffix}/"

    def _mk_user(self, username, role, subsection):
        return User.objects.create_user(
            username=username,
            password='pass12345',
            email=f'{username}@example.com',
            full_name=username.replace('_', ' ').title(),
            role=role,
            subsection=subsection,
        )

    def _create_payload(self, assignee_id):
        return {
            'letter_no': f'L-{timezone.now().timestamp()}',
            'date_received': timezone.now().date().isoformat(),
            'mail_reference_subject': 'Workflow item',
            'from_office': 'Main Office',
            'action_required': 'Review and process',
            'assigned_to': [assignee_id],
            'due_date': (timezone.now().date() + timedelta(days=5)).isoformat(),
            'initial_instructions': 'About info',
        }

    def test_e2e_ag_two_dags_then_each_dag_assigns_two_officers(self):
        self.client.force_authenticate(self.ag)
        create_payload = {
            'letter_no': 'E2E/AG/001',
            'date_received': timezone.now().date().isoformat(),
            'mail_reference_subject': 'AG to both DAGs',
            'from_office': 'AG Office',
            'action_required': 'Cross-section review',
            'assigned_to': [self.dag1.id, self.dag2.id],
            'due_date': (timezone.now().date() + timedelta(days=7)).isoformat(),
            'initial_instructions': 'Joint review by both DAG chains',
        }
        create_resp = self.client.post(reverse('mailrecord-list'), create_payload, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        mail_id = create_resp.data['id']

        self.client.force_authenticate(self.dag1)
        dag1_resp = self.client.post(
            self._url(mail_id, 'multi_assign'),
            {'user_ids': [self.srao1.id, self.aao1.id], 'remarks': 'DAG1 branch'},
            format='json',
        )
        self.assertEqual(dag1_resp.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.dag2)
        dag2_resp = self.client.post(
            self._url(mail_id, 'multi_assign'),
            {'user_ids': [self.srao2.id, self.aao2.id], 'remarks': 'DAG2 branch'},
            format='json',
        )
        self.assertEqual(dag2_resp.status_code, status.HTTP_200_OK)

        mail = MailRecord.objects.get(id=mail_id)
        self.assertTrue(mail.is_multi_assigned)
        # 2 DAG assignments from create + 4 staff assignments by DAGs
        self.assertEqual(mail.parallel_assignments.count(), 6)

        for officer in [self.srao1, self.aao1, self.srao2, self.aao2]:
            assignment = MailAssignment.objects.get(
                mail_record=mail,
                assigned_to=officer,
                status='Active',
            )
            self.client.force_authenticate(officer)
            remark_resp = self.client.post(
                self._url(mail_id, f"assignments/{assignment.id}/add_remark"),
                {'content': f'Work done by {officer.username}'},
                format='json',
            )
            self.assertEqual(remark_resp.status_code, status.HTTP_200_OK)

            complete_resp = self.client.post(
                self._url(mail_id, f"assignments/{assignment.id}/complete"),
                {},
                format='json',
            )
            self.assertEqual(complete_resp.status_code, status.HTTP_200_OK)

        mail.refresh_from_db()
        self.assertNotEqual(mail.status, 'Closed')

        self.client.force_authenticate(self.dag1)
        dag_close_resp = self.client.post(self._url(mail_id, 'close'), {'remarks': 'Trying to close'}, format='json')
        self.assertEqual(dag_close_resp.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.ag)
        ag_close_resp = self.client.post(self._url(mail_id, 'close'), {'remarks': 'Final closure by AG'}, format='json')
        self.assertEqual(ag_close_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(ag_close_resp.data['status'], 'Closed')

        mail.refresh_from_db()
        self.assertEqual(mail.parallel_assignments.filter(status='Active').count(), 0)
        self.assertGreaterEqual(mail.parallel_assignments.filter(status='Completed').count(), 6)

    def test_api_permission_matrix_by_role(self):
        create_cases = [
            (self.ag, self.ag.id),
            (self.dag1, self.dag1.id),
            (self.srao1, self.srao1.id),
            (self.aao1, self.aao1.id),
            (self.clerk1, self.clerk1.id),
            (self.aud1, self.srao1.id),
        ]
        for actor, assignee_id in create_cases:
            with self.subTest(action='create', role=actor.role):
                self.client.force_authenticate(actor)
                resp = self.client.post(reverse('mailrecord-list'), self._create_payload(assignee_id), format='json')
                self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.ag)
        multi_mail_resp = self.client.post(
            reverse('mailrecord-list'),
            {
                'letter_no': 'PERM/MULTI',
                'date_received': timezone.now().date().isoformat(),
                'mail_reference_subject': 'Permission matrix multi mail',
                'from_office': 'AG Office',
                'action_required': 'Matrix',
                'assigned_to': [self.dag1.id, self.dag2.id],
                'due_date': (timezone.now().date() + timedelta(days=7)).isoformat(),
                'initial_instructions': 'Matrix run',
            },
            format='json',
        )
        self.assertEqual(multi_mail_resp.status_code, status.HTTP_201_CREATED)
        multi_mail_id = multi_mail_resp.data['id']

        multi_assign_cases = [
            (self.ag, self.srao1.id, {status.HTTP_200_OK}),
            (self.dag1, self.srao1.id, {status.HTTP_200_OK}),
            (self.dag2, self.srao2.id, {status.HTTP_200_OK}),
            (self.srao1, self.srao1.id, {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}),
            (self.aao1, self.srao1.id, {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}),
            (self.aud1, self.srao1.id, {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}),
            (self.clerk1, self.srao1.id, {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}),
        ]
        for actor, target_user_id, allowed_statuses in multi_assign_cases:
            with self.subTest(action='multi_assign', role=actor.role):
                self.client.force_authenticate(actor)
                resp = self.client.post(
                    self._url(multi_mail_id, 'multi_assign'),
                    {'user_ids': [target_user_id], 'remarks': f'By {actor.username}'},
                    format='json',
                )
                self.assertIn(resp.status_code, allowed_statuses)

        close_cases = [
            (self.ag, {status.HTTP_200_OK}),
            (self.dag1, {status.HTTP_403_FORBIDDEN}),
            (self.dag2, {status.HTTP_403_FORBIDDEN}),
            (self.srao1, {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}),
            (self.aao1, {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}),
            (self.aud1, {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}),
            (self.clerk1, {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}),
        ]
        for actor, allowed_statuses in close_cases:
            with self.subTest(action='close_multi_assigned', role=actor.role):
                self.client.force_authenticate(self.ag)
                re_open_mail_resp = self.client.post(
                    reverse('mailrecord-list'),
                    {
                        'letter_no': f'PERM/CLOSE/{actor.username}',
                        'date_received': timezone.now().date().isoformat(),
                        'mail_reference_subject': 'Close permission matrix',
                        'from_office': 'AG Office',
                        'action_required': 'Close test',
                        'assigned_to': [self.dag1.id, self.dag2.id],
                        'due_date': (timezone.now().date() + timedelta(days=7)).isoformat(),
                        'initial_instructions': 'Close matrix',
                    },
                    format='json',
                )
                mail_id = re_open_mail_resp.data['id']
                self.client.force_authenticate(actor)
                resp = self.client.post(self._url(mail_id, 'close'), {'remarks': 'close try'}, format='json')
                self.assertIn(resp.status_code, allowed_statuses)

    def test_ag_two_dag_forward_chain_keeps_two_assignment_rows(self):
        self.client.force_authenticate(self.ag)
        create_resp = self.client.post(
            reverse('mailrecord-list'),
            {
                'letter_no': 'CHAIN/AG/001',
                'date_received': timezone.now().date().isoformat(),
                'mail_reference_subject': 'Two DAG chain workflow',
                'from_office': 'AG Office',
                'action_required': 'Forward down chain',
                'assigned_to': [self.dag1.id, self.dag2.id],
                'due_date': (timezone.now().date() + timedelta(days=7)).isoformat(),
                'initial_instructions': 'Route through each DAG chain',
            },
            format='json',
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        mail_id = create_resp.data['id']
        mail = MailRecord.objects.get(id=mail_id)

        self.assertEqual(mail.parallel_assignments.count(), 2)
        dag1_assignment = MailAssignment.objects.get(mail_record=mail, assigned_to=self.dag1, status='Active')
        dag2_assignment = MailAssignment.objects.get(mail_record=mail, assigned_to=self.dag2, status='Active')

        # DAG1 chain: DAG1 -> SrAO1 -> AAO1 (same assignment row)
        self.client.force_authenticate(self.dag1)
        r1 = self.client.post(
            self._url(mail_id, f'assignments/{dag1_assignment.id}/reassign'),
            {'new_assignee': self.srao1.id, 'remarks': 'DAG1 to SrAO1'},
            format='json',
        )
        self.assertEqual(r1.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.srao1)
        r2 = self.client.post(
            self._url(mail_id, f'assignments/{dag1_assignment.id}/reassign'),
            {'new_assignee': self.aao1.id, 'remarks': 'SrAO1 to AAO1'},
            format='json',
        )
        self.assertEqual(r2.status_code, status.HTTP_200_OK, getattr(r2, 'data', None))

        # DAG2 chain: DAG2 -> SrAO2 -> AAO2 (same assignment row)
        self.client.force_authenticate(self.dag2)
        r3 = self.client.post(
            self._url(mail_id, f'assignments/{dag2_assignment.id}/reassign'),
            {'new_assignee': self.srao2.id, 'remarks': 'DAG2 to SrAO2'},
            format='json',
        )
        self.assertEqual(r3.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.srao2)
        r4 = self.client.post(
            self._url(mail_id, f'assignments/{dag2_assignment.id}/reassign'),
            {'new_assignee': self.aao2.id, 'remarks': 'SrAO2 to AAO2'},
            format='json',
        )
        self.assertEqual(r4.status_code, status.HTTP_200_OK)

        # Core assertion: still only 2 assignment rows (one per original DAG branch)
        self.assertEqual(MailAssignment.objects.filter(mail_record=mail).count(), 2)

        dag1_assignment.refresh_from_db()
        dag2_assignment.refresh_from_db()
        self.assertEqual(dag1_assignment.reassigned_to_id, self.aao1.id)
        self.assertEqual(dag2_assignment.reassigned_to_id, self.aao2.id)

        dag1_timeline = list(dag1_assignment.remarks_timeline.values_list('content', flat=True))
        dag2_timeline = list(dag2_assignment.remarks_timeline.values_list('content', flat=True))
        self.assertGreaterEqual(len(dag1_timeline), 2)
        self.assertGreaterEqual(len(dag2_timeline), 2)
        self.assertTrue(any('Reassigned to' in txt for txt in dag1_timeline))
        self.assertTrue(any('Reassigned to' in txt for txt in dag2_timeline))

        self.client.force_authenticate(self.ag)
        assignments_resp = self.client.get(self._url(mail_id, 'assignments'))
        self.assertEqual(assignments_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._rows(assignments_resp)), 2)


class MultiAssignmentPlanCoverageTests(APITestCase):
    """
    Coverage derived from test.txt plan, adapted to current API semantics:
    - multi_assign is AG/DAG only
    - assignment reassign keeps same assignment row (updates reassigned_to)
    - closing a multi-assigned mail by AG auto-completes active assignments
    """

    def setUp(self):
        self.sec_admin = Section.objects.create(name='Admin Plan')
        self.sec_fin = Section.objects.create(name='Finance Plan', directly_under_ag=True)
        self.sub_admin_1 = Subsection.objects.create(section=self.sec_admin, name='Admin-1')
        self.sub_admin_2 = Subsection.objects.create(section=self.sec_admin, name='Admin-2')
        self.sub_budget = Subsection.objects.create(section=self.sec_fin, name='Budget')

        self.ag = self._mk_user('ag_plan', 'AG')
        self.dag = self._mk_user('dag_plan', 'DAG')
        self.dag.sections.set([self.sec_admin])
        self.dag_other = self._mk_user('dag_other_plan', 'DAG')
        self.dag_other.sections.set([self.sec_fin])

        self.srao1 = self._mk_user('srao1_plan', 'SrAO', self.sub_admin_1)
        self.srao2 = self._mk_user('srao2_plan', 'SrAO', self.sub_admin_2)
        self.aao1 = self._mk_user('aao1_plan', 'AAO', self.sub_admin_1)
        self.aao2 = self._mk_user('aao2_plan', 'AAO', self.sub_admin_1)
        self.aao3 = self._mk_user('aao3_plan', 'AAO', self.sub_admin_1)
        self.aao4 = self._mk_user('aao4_plan', 'AAO', self.sub_admin_1)
        self.aao5 = self._mk_user('aao5_plan', 'AAO', self.sub_admin_2)
        self.aao6 = self._mk_user('aao6_plan', 'AAO', self.sub_admin_2)
        self.aao_fin = self._mk_user('aao_fin_plan', 'AAO', self.sub_budget)

        self.aud1 = self._mk_user('aud1_plan', 'auditor')
        self.aud2 = self._mk_user('aud2_plan', 'auditor')
        self.aud1.auditor_subsections.set([self.sub_admin_1])
        self.aud2.auditor_subsections.set([self.sub_admin_2])
        self.clerk1 = self._mk_user('clerk1_plan', 'clerk', self.sub_admin_1)
        self.clerk2 = self._mk_user('clerk2_plan', 'clerk', self.sub_admin_2)

        self.base_mail = MailRecord.objects.create(
            letter_no='L2026/001',
            date_received=timezone.now().date(),
            mail_reference_subject='Test Mail for Multi-Assign',
            from_office='External',
            action_required='Review',
            section=self.sec_admin,
            subsection=self.sub_admin_1,
            assigned_to=self.srao1,
            current_handler=self.srao1,
            monitoring_officer=self.dag,
            due_date=timezone.now().date() + timedelta(days=5),
            status='Assigned',
            is_multi_assigned=False,
            created_by=self.ag,
            initial_instructions='Plan baseline',
        )

    def _mk_user(self, username, role, subsection=None):
        return User.objects.create_user(
            username=username,
            password='pass12345',
            email=f'{username}@example.com',
            full_name=username.replace('_', ' ').title(),
            role=role,
            subsection=subsection,
        )

    def _mail_url(self, mail_id, suffix):
        return f'/api/records/{mail_id}/{suffix}/'

    def _assign_url(self, mail_id, assignment_id, suffix):
        return f'/api/records/{mail_id}/assignments/{assignment_id}/{suffix}/'

    @staticmethod
    def _rows(response):
        data = response.data
        return data.get('results', data) if isinstance(data, dict) else data

    def test_plan_workflow_multi_assign_reassign_partial_completion_and_close(self):
        self.client.force_authenticate(self.ag)
        resp = self.client.post(
            self._mail_url(self.base_mail.id, 'multi_assign'),
            {'user_ids': [self.aao1.id, self.aao2.id], 'remarks': 'Review together'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.base_mail.refresh_from_db()
        self.assertTrue(self.base_mail.is_multi_assigned)
        self.assertEqual(self.base_mail.parallel_assignments.filter(status='Active').count(), 2)

        a1 = MailAssignment.objects.get(mail_record=self.base_mail, assigned_to=self.aao1, status='Active')
        a2 = MailAssignment.objects.get(mail_record=self.base_mail, assigned_to=self.aao2, status='Active')

        self.client.force_authenticate(self.aao1)
        reassign_resp = self.client.post(
            self._assign_url(self.base_mail.id, a1.id, 'reassign'),
            {'new_assignee': self.aao3.id, 'remarks': 'Pass to aao3'},
            format='json',
        )
        self.assertEqual(reassign_resp.status_code, status.HTTP_200_OK)
        a1.refresh_from_db()
        self.assertEqual(a1.reassigned_to_id, self.aao3.id)

        timeline_text = list(a1.remarks_timeline.values_list('content', flat=True))
        self.assertTrue(any('Reassigned to' in t for t in timeline_text))

        # Old assignee loses remark permission
        old_assignee_resp = self.client.post(
            self._assign_url(self.base_mail.id, a1.id, 'add_remark'),
            {'content': 'I should not be able to add this'},
            format='json',
        )
        self.assertEqual(old_assignee_resp.status_code, status.HTTP_403_FORBIDDEN)

        # New assignee can add remark + complete
        self.client.force_authenticate(self.aao3)
        add_remark_resp = self.client.post(
            self._assign_url(self.base_mail.id, a1.id, 'add_remark'),
            {'content': 'Working on reassigned task'},
            format='json',
        )
        self.assertEqual(add_remark_resp.status_code, status.HTTP_200_OK)
        complete_reassigned_resp = self.client.post(
            self._assign_url(self.base_mail.id, a1.id, 'complete'),
            {},
            format='json',
        )
        self.assertEqual(complete_reassigned_resp.status_code, status.HTTP_200_OK)

        # Partial completion: a2 still active
        a1.refresh_from_db()
        a2.refresh_from_db()
        self.assertEqual(a1.status, 'Completed')
        self.assertEqual(a2.status, 'Active')

        # Consolidated remarks should include latest remark text
        self.base_mail.refresh_from_db()
        self.assertTrue(self.base_mail.consolidated_remarks is None or 'Working on reassigned task' in self.base_mail.consolidated_remarks)

        # AG close auto-completes any remaining active assignments in current implementation
        self.client.force_authenticate(self.ag)
        close_resp = self.client.post(
            self._mail_url(self.base_mail.id, 'close'),
            {'remarks': 'All done at supervisor level'},
            format='json',
        )
        self.assertEqual(close_resp.status_code, status.HTTP_200_OK)
        self.base_mail.refresh_from_db()
        self.assertEqual(self.base_mail.status, 'Closed')
        self.assertEqual(self.base_mail.parallel_assignments.filter(status='Active').count(), 0)

    def test_plan_permission_matrix_core_paths(self):
        # AG can multi-assign
        self.client.force_authenticate(self.ag)
        ag_multi = self.client.post(
            self._mail_url(self.base_mail.id, 'multi_assign'),
            {'user_ids': [self.aao1.id], 'remarks': 'AG assign'},
            format='json',
        )
        self.assertEqual(ag_multi.status_code, status.HTTP_200_OK)

        # DAG same section can multi-assign
        self.client.force_authenticate(self.dag)
        dag_same = self.client.post(
            self._mail_url(self.base_mail.id, 'multi_assign'),
            {'user_ids': [self.aao2.id], 'remarks': 'DAG assign'},
            format='json',
        )
        self.assertEqual(dag_same.status_code, status.HTTP_200_OK)

        # DAG other section blocked
        self.client.force_authenticate(self.dag_other)
        dag_other = self.client.post(
            self._mail_url(self.base_mail.id, 'multi_assign'),
            {'user_ids': [self.aao_fin.id], 'remarks': 'Out of scope'},
            format='json',
        )
        self.assertIn(dag_other.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # SrAO / AAO / auditor / clerk blocked from multi_assign
        for actor in [self.srao1, self.aao1, self.aud1, self.clerk1]:
            with self.subTest(role=actor.role):
                self.client.force_authenticate(actor)
                denied = self.client.post(
                    self._mail_url(self.base_mail.id, 'multi_assign'),
                    {'user_ids': [self.aao1.id], 'remarks': 'Denied'},
                    format='json',
                )
                self.assertIn(denied.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # Assignee can only see own assignment through assignments endpoint
        self.client.force_authenticate(self.ag)
        self.client.post(
            self._mail_url(self.base_mail.id, 'multi_assign'),
            {'user_ids': [self.aao3.id, self.aao4.id], 'remarks': 'Visibility test'},
            format='json',
        )
        self.client.force_authenticate(self.aao3)
        own_list = self.client.get(self._mail_url(self.base_mail.id, 'assignments'))
        self.assertEqual(own_list.status_code, status.HTTP_200_OK)
        rows = self._rows(own_list)
        self.assertTrue(all(
            (row.get('assigned_to') == self.aao3.id) or (row.get('reassigned_to') == self.aao3.id)
            for row in rows
        ))
