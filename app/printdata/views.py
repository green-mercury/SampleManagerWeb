from flask import render_template
from . import printdata
from ..models import Sample
from forms import RequestActionsForm
from flask.ext.login import login_required, current_user
from datetime import datetime

@printdata.route('/', methods=['GET', 'POST'])
@login_required
def overview():
    form = RequestActionsForm()
    actions = []
    if form.validate_on_submit():
        sampleid = int(form.sampleid.data) if form.sampleid.data else 0

        try: datefrom = datetime.strptime(form.datefrom.data, "%Y-%m-%d").date()
        except ValueError: datefrom = None
        try: dateto = datetime.strptime(form.dateto.data, "%Y-%m-%d").date()
        except ValueError: dateto = None

        def tree(samples):
            if not samples:
                return []
            result = []
            for s in samples:
                result.append(s)
                result.extend(tree(s.children))
            return result

        own_samples = Sample.query.filter_by(owner=current_user, parent_id=0).all()
        shares = [s.sample for s in current_user.shares]
        all_samples = tree(own_samples+shares)

        actions = []
        for s in all_samples:
            if sampleid and sampleid != s.id:
                continue
            for a in s.actions:
                if datefrom and a.timestamp and a.timestamp < datefrom:
                    continue
                if dateto and a.timestamp and a.timestamp > dateto:
                    continue
                actions.append(a)
        actions = sorted(actions, key=lambda x: x.ordnum)
        actions = sorted(actions, key=lambda x: x.sample_id)
    return render_template('print.html', form=form, actions=actions, sampleerror=True if form.sampleid.data == "-1" else False)